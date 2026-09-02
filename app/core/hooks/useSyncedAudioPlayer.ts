// app/core/hooks/useSyncedAudioPlayer.ts
import { useEffect, useRef, useState } from 'react'
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio'

type UseSyncedAudioPlayerOptions = {
    previewUrl?: string | null
    autoPlay?: boolean
    // timestamp serveur (Date.now() epoch, cf. round.startedAt) auquel la
    // lecture doit démarrer sur TOUS les appareils en même temps. Sans lui,
    // la lecture démarre dès que le buffer local est prêt — ce qui varie
    // selon le réseau de chaque joueur et désynchronise le son perçu d'un
    // appareil à l'autre.
    startedAt?: number
}

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

// délai avant de forcer un premier play() SANS attendre status.isLoaded (cf.
// plus bas) : confirmé par l'utilisateur, allonger la fenêtre de rattrapage
// ci-dessus n'a rien changé pour les extraits qui restaient bloqués, alors
// que le bouton play manuel (qui n'attend pas isLoaded, lui) fonctionne à
// chaque fois — ce n'était donc pas un problème de délai de rattrapage, mais
// le rattrapage qui ne se déclenchait JAMAIS : tout le mécanisme ci-dessus
// (et donc AUTOPLAY_MAX_RETRIES) est gardé par hasAttempted, lui-même gardé
// par status.isLoaded, qui ne passe apparemment jamais à true pour certains
// extraits sur certains Android, sans qu'aucune erreur ne remonte.
// Compromis à ajuster ici si besoin : plus bas = les extraits qui buguent
// démarrent plus vite, mais un extrait normal juste un peu lent à charger a
// plus de chances de se faire doubler par ce filet avant que le chemin
// normal (synchronisé sur startedAt, cf. l'effet précédent) n'ait fini —
// dans ce cas il démarre quand même, juste un peu désynchronisé par rapport
// aux autres joueurs le temps que le rattrapage de position le recale.
const FORCE_PLAY_TIMEOUT_MS = 1200

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
export const useSyncedAudioPlayer = ({ previewUrl, autoPlay = true, startedAt }: UseSyncedAudioPlayerOptions) => {
    // updateInterval par défaut (500ms) : ni la position ni la durée ne sont
    // affichées, seulement isLoaded/playing (qui remontent immédiatement via
    // leurs propres listeners natifs, indépendamment de cet intervalle) — 1s
    // suffit largement et divise par 2 la fréquence de re-render pendant la lecture.
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

    useEffect(() => {
        if (!autoPlay || !status.isLoaded || syncedForUrlRef.current === previewUrl) return
        syncedForUrlRef.current = previewUrl

        if (startedAt === undefined) {
            player.play()
            setHasAttempted(true)
            return
        }

        const delayMs = startedAt - Date.now()
        if (delayMs <= 0) {
            // le buffer a fini après l'instant de synchro commun (réseau
            // lent) : on rejoint directement à la bonne position plutôt que
            // de repartir de 0, ce qui laisserait cet appareil décalé pour
            // tout le reste de l'extrait par rapport à ceux qui ont démarré
            // à l'heure
            const offsetSeconds = -delayMs / 1000
            const clamped =
                player.duration > 0 ? Math.min(offsetSeconds, Math.max(0, player.duration - 0.1)) : offsetSeconds
            player.seekTo(clamped).then(() => {
                player.play()
                setHasAttempted(true)
            })
            return
        }

        const timeout = setTimeout(() => {
            player.play()
            setHasAttempted(true)
        }, delayMs)
        return () => clearTimeout(timeout)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [status.isLoaded, startedAt, previewUrl])

    // filet pour le cas où status.isLoaded ne passe JAMAIS à true (cf.
    // FORCE_PLAY_TIMEOUT_MS ci-dessus) : sans lui, l'effet précédent ne
    // déclenche jamais rien, hasAttempted reste bloqué à false, et le filet
    // de rattrapage suivant ne se déclenche jamais non plus (il est gardé
    // par hasAttempted). Après ce délai, si la lecture n'a toujours pas été
    // tentée, on force un play() sans plus attendre isLoaded — exactement ce
    // que fait le bouton play manuel, qui lui fonctionne. Annulé sans effet
    // si l'effet précédent a fini par se déclencher entre-temps (hasAttempted
    // passe à true, ce qui redéclenche celui-ci et le fait ressortir tout de
    // suite sans reprogrammer de timeout).
    useEffect(() => {
        if (!autoPlay || hasAttempted) return
        const timeout = setTimeout(() => {
            player.play()
            setHasAttempted(true)
        }, FORCE_PLAY_TIMEOUT_MS)
        return () => clearTimeout(timeout)
    }, [autoPlay, hasAttempted, previewUrl, player])

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
