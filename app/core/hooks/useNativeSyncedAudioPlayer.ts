// app/core/hooks/useNativeSyncedAudioPlayer.ts
//
// Implémentation native (iOS/Android en app, via expo-audio) de
// useSyncedAudioPlayer — cf. useSyncedAudioPlayer.ts pour le dispatch et
// useWebSyncedAudioPlayer.ts pour l'équivalent web, qui n'utilise PAS
// expo-audio (son <audio> HTMLMediaElement exige un geste utilisateur pour
// chaque nouvel élément créé sur iOS Safari, incompatible avec des manches
// qui s'enchaînent toutes seules — cf. ce fichier web pour le détail).
import { useEffect, useRef, useState } from 'react'
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio'
import type { UseSyncedAudioPlayerOptions } from './useSyncedAudioPlayer.types'

// nombre de tentatives de rattrapage (cf. plus bas) avant d'abandonner, et
// délai entre chacune : sur certains Android peu puissants, l'appel play()
// initial peut ne jamais démarrer réellement la lecture (le lecteur reste
// chargé, status.playing ne passe jamais à true), sans qu'aucune erreur ne
// remonte. Confirmé en conditions réelles : le son fonctionne bien sur ces
// téléphones (le bouton play manuel marche), c'est bien une question de
// délai — le buffer n'est parfois pas encore vraiment prêt à jouer au
// moment du premier essai, même si isLoaded est déjà passé à true. Constaté
// avec des manches de 5s : la fenêtre doit largement dépasser la durée
// d'une manche courte, puisque ce filet doit continuer à essayer même après
// la bascule sur l'écran de résultat (qui peut rester affiché plus
// longtemps qu'une manche, cf. manualAdvance) si l'extrait n'a toujours pas
// démarré à ce moment-là — le bouton play/pause manuel reste le filet de
// secours ultime si même ça ne suffit pas (cf. AudioPlayerButton).
const AUTOPLAY_MAX_RETRIES = 20
const AUTOPLAY_RETRY_DELAY_MS = 800

// délai avant de tenter la synchro SANS attendre status.isLoaded (cf.
// attemptSyncedPlay plus bas). Ce filet exécute exactement la MÊME logique
// de synchro sur startedAt que le chemin normal (jamais un simple play()
// immédiat), donc l'abaisser ne désynchronise plus personne — MAIS l'avoir
// baissé trop bas (300ms) s'est révélé une mauvaise idée dans l'autre sens :
// ça forçait play() avant que le buffer Android (confirmé plus lent à
// charger que sur iPhone) soit vraiment prêt, pour BEAUCOUP d'extraits, pas
// seulement les rares vraiment bloqués — et forcer trop tôt semble mettre le
// lecteur dans un état que même les tentatives suivantes ne rattrapent plus.
// Remonté à une valeur plus proche de ce qui marchait avant la fusion des
// deux chemins (cf. commit précédent), le temps de mesurer le bon compromis
// en conditions réelles.
const FORCE_PLAY_TIMEOUT_MS = 1500

// `useAudioPlayer` ne recrée l'instance native QUE si `previewUrl` change
// (et libère l'ancienne automatiquement, cf. expo-audio) : appeler ce hook
// une seule fois, monté en permanence tant que la manche est affichée (que ce
// soit l'écran de question ou celui de résultat, cf. game.screen.tsx), plutôt
// qu'une fois par écran, est ce qui évite le petit saut/rechargement audible
// au changement d'écran — avant, chaque écran montait son propre <AudioPlayer>
// avec le même previewUrl, ce qui recréait quand même une instance native
// (donc un rechargement du flux) à chaque bascule de phase.
//
// `status.didJustFinish` (renvoyé ci-dessous) est laissé à l'appelant plutôt
// que géré ici : la décision de relancer l'extrait dépend de l'écran affiché
// AU MOMENT où il finit (cf. game.screen.tsx), une logique propre à la partie
// qui n'a pas sa place dans ce hook générique.
export const useNativeSyncedAudioPlayer = ({
    previewUrl,
    autoPlay = true,
    startedAt,
}: UseSyncedAudioPlayerOptions) => {
    // updateInterval : ni la position ni la durée ne sont affichées, seulement
    // isLoaded/playing. isLoaded remonte immédiatement (event natif dédié),
    // mais PAS playing sur iOS (confirmé dans le code source d'expo-audio,
    // AudioPlayer.swift) : contrairement à Android (listener natif dédié,
    // immédiat), iOS ne renvoie "playing" que via le tick périodique cadencé
    // par cet intervalle — donc status.playing peut rester figé à false
    // jusqu'à updateInterval ms après un play() qui a pourtant déjà démarré.
    // C'était la vraie cause de la désynchro entre iPhones : le filet de
    // rattrapage plus bas se basait sur ce status.playing en retard et
    // relançait play()/seekTo() en double alors que la lecture avait déjà
    // bien commencé (cf. le check sur player.playing, en direct, plus bas).
    const player = useAudioPlayer(previewUrl ?? null, { updateInterval: 1000 })
    const status = useAudioPlayerStatus(player)

    // ce rattrapage (rejoindre startedAt) ne doit se faire qu'UNE FOIS par
    // extrait chargé, pas à chaque fois que status.isLoaded change de valeur.
    // Observé sur Android : un seekTo() (cf. game.screen.tsx, qui relance
    // l'extrait via ce même player) peut faire re-basculer isLoaded à false
    // puis true pendant le rebuffering qui suit — sans ce garde-fou, cet
    // effet se redéclenchait alors avec un startedAt resté figé (donc de plus
    // en plus ancien), recalculait un décalage énorme et re-sautait près de
    // la fin de l'extrait, ce qui déclenchait aussitôt une nouvelle "fin de
    // lecture" côté game.screen.tsx → nouveau redémarrage → nouveau seekTo →
    // boucle, perçue comme le bouton play/pause qui s'active/se désactive
    // très vite.
    const syncedForUrlRef = useRef<string | null | undefined>(undefined)

    // passe à true dès que player.play() a été RÉELLEMENT appelé (pas
    // seulement programmé, cf. le setTimeout plus bas) pour le previewUrl
    // courant : sert de départ au filet de rattrapage plus bas, pour ne
    // jamais le déclencher pendant l'attente légitime de startedAt.
    const [hasAttempted, setHasAttempted] = useState(false)
    const [retryAttempt, setRetryAttempt] = useState(0)

    useEffect(() => {
        setHasAttempted(false)
        setRetryAttempt(0)
    }, [previewUrl])

    // déclenché par DEUX sources : dès que status.isLoaded passe à true (cas
    // normal), OU après FORCE_PLAY_TIMEOUT_MS si isLoaded n'a toujours pas
    // bougé (cf. plus haut : n'arrive jamais pour certains extraits sur
    // certains Android, sans erreur remontée) — quelle que soit la source,
    // c'est TOUJOURS la même logique de synchro sur startedAt qui s'exécute
    // (attemptSyncedPlay ci-dessous), jamais un simple play() immédiat :
    // sans ça, le filet de secours démarrait l'extrait dès qu'il le pouvait,
    // chacun à son rythme, ce qui désynchronisait le son perçu d'un appareil
    // à l'autre — précisément ce que ce hook est censé éviter.
    useEffect(() => {
        if (!autoPlay || syncedForUrlRef.current === previewUrl) return

        let innerTimeout: ReturnType<typeof setTimeout> | undefined

        // marque `previewUrl` comme synchronisé SEULEMENT au moment où
        // player.play() est réellement appelé, jamais avant de programmer un
        // timer qui pourrait encore être annulé (cf. plus bas) : sinon, si
        // status.isLoaded passe à true PENDANT qu'un timer de rattrapage
        // (innerTimeout, programmé sur startedAt) est déjà en attente,
        // l'effet se redéclenche (isLoaded a changé), son nettoyage annule
        // ce timer en attente — et comme le garde-fou du haut de cet effet
        // voyait déjà syncedForUrlRef marqué, le nouvel effet ressortait
        // aussitôt SANS rien reprogrammer. Ce marquage prématuré a été
        // repéré comme la cause d'un extrait qui ne se lançait plus du tout
        // (constaté en conditions réelles) plutôt que rarement.
        const attemptSyncedPlay = () => {
            if (syncedForUrlRef.current === previewUrl) return

            if (startedAt === undefined) {
                syncedForUrlRef.current = previewUrl
                player.play()
                setHasAttempted(true)
                return
            }

            const delayMs = startedAt - Date.now()
            if (delayMs <= 0) {
                // le buffer a fini après l'instant de synchro commun (réseau
                // lent) : on rejoint directement à la bonne position plutôt
                // que de repartir de 0, ce qui laisserait cet appareil
                // décalé pour tout le reste de l'extrait par rapport à ceux
                // qui ont démarré à l'heure
                syncedForUrlRef.current = previewUrl
                const offsetSeconds = -delayMs / 1000
                const clamped =
                    player.duration > 0 ? Math.min(offsetSeconds, Math.max(0, player.duration - 0.1)) : offsetSeconds
                player.seekTo(clamped).then(() => {
                    player.play()
                    setHasAttempted(true)
                })
                return
            }

            innerTimeout = setTimeout(() => {
                syncedForUrlRef.current = previewUrl
                player.play()
                setHasAttempted(true)
            }, delayMs)
        }

        let forceTimeout: ReturnType<typeof setTimeout> | undefined
        if (status.isLoaded) {
            attemptSyncedPlay()
        } else {
            forceTimeout = setTimeout(attemptSyncedPlay, FORCE_PLAY_TIMEOUT_MS)
        }

        return () => {
            if (innerTimeout) clearTimeout(innerTimeout)
            if (forceTimeout) clearTimeout(forceTimeout)
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [status.isLoaded, startedAt, previewUrl])

    // filet de rattrapage (cf. AUTOPLAY_MAX_RETRIES/AUTOPLAY_RETRY_DELAY_MS
    // en haut de fichier) : si la lecture a bien été demandée (hasAttempted)
    // mais que status.playing ne passe jamais à true, on retente nous-mêmes,
    // un nombre de fois limité, avant d'abandonner. Ce n'est volontairement
    // PAS gardé par un seul essai (contrairement à syncedForUrlRef ci-dessus,
    // qui protège le rattrapage de startedAt) : bumper retryAttempt à chaque
    // tentative redéclenche cet effet, qui revérifie alors si la lecture a
    // fini par démarrer entre-temps avant de retenter ou d'abandonner.
    useEffect(() => {
        if (!autoPlay || !hasAttempted || status.playing) return
        if (retryAttempt >= AUTOPLAY_MAX_RETRIES) return

        const timeout = setTimeout(() => {
            // `player.playing` = état natif EN DIRECT (property native, pas
            // l'event périodique) — contrairement à status.playing (utilisé
            // seulement pour déclencher cet effet), il n'a pas le retard
            // décrit plus haut. Sans ce re-check, ce filet relançait play()
            // (voire seekTo(0)+play(), qui redémarre l'extrait depuis 0) sur
            // un iPhone où la lecture avait déjà bien démarré mais où
            // status.playing n'était pas encore remonté — désynchronisant
            // cet appareil des autres pour rien.
            if (player.playing) {
                setRetryAttempt((n) => n + 1)
                return
            }

            // toutes les 3 tentatives, un rattrapage plus "dur" (seekTo(0)
            // avant play()) plutôt qu'un simple play() : un lecteur parfois
            // coincé dans un état où rappeler play() seul ne suffit pas à
            // relancer le buffer — même repli que restartPreview
            // (game.screen.tsx) pour un souci de même famille
            if (retryAttempt > 0 && retryAttempt % 3 === 0) {
                player.seekTo(0).then(() => player.play())
            } else {
                player.play()
            }
            setRetryAttempt((n) => n + 1)
        }, AUTOPLAY_RETRY_DELAY_MS)
        return () => clearTimeout(timeout)
    }, [autoPlay, hasAttempted, status.playing, retryAttempt, player])

    const toggle = () => {
        if (status.playing) player.pause()
        else player.play()
    }

    return { player, status, toggle }
}
