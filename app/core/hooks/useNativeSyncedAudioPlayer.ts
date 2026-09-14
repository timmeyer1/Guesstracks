// app/core/hooks/useNativeSyncedAudioPlayer.ts
//
// En mode, c'est la version native (iOS/Android, via expo-audio) du lecteur
// audio synchro. Le dispatch se fait dans useSyncedAudioPlayer.ts, et la
// version web (useWebSyncedAudioPlayer.ts) est différente dcp le <audio> du
// navigateur demande un clic utilisateur à chaque nouvel extrait sur Safari
// iOS, ce qui casse l'enchaînement automatique des manches.
import { useEffect, useRef, useState } from 'react'
import { AppState, type AppStateStatus } from 'react-native'
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio'
import type { UseSyncedAudioPlayerOptions } from './useSyncedAudioPlayer.types'
import { configureAudioMode } from './useAudioModeSetup'

// Sur certains Android un peu poussifs, le premier play() peut ne jamais
// vraiment démarrer le son (pas d'erreur, juste rien qui se passe) même si
// le buffer semble prêt. En gros ces constantes servent à réessayer tout
// seul plusieurs fois avant de laisser tomber. Le délai doit tenir plus
// longtemps qu'une manche courte, et le bouton play manuel reste le filet
// de secours ultime si ça suffit toujours pas.
const AUTOPLAY_MAX_RETRIES = 20
const AUTOPLAY_RETRY_DELAY_MS = 800

// Délai avant de forcer le lancement même si status.isLoaded n'est toujours
// pas passé à true. On a testé plus bas (300ms) mais ça forçait play() trop
// tôt sur Android, qui charge plus lentement que l'iPhone, et ça plantait
// pas mal d'extraits. Cette valeur est un compromis, à surveiller en vrai.
const FORCE_PLAY_TIMEOUT_MS = 1500

// En gros, `useAudioPlayer` ne recrée le lecteur que si `previewUrl` change.
// Donc on monte ce hook une seule fois pour toute la manche (question +
// résultat), pas un par écran, sinon ça recrée le lecteur à chaque écran et
// ça fait un petit saut de son audible.
//
// `status.didJustFinish` est renvoyé tel quel : c'est game.screen.tsx qui
// décide quoi faire à la fin de l'extrait, pas ce hook.
export const useNativeSyncedAudioPlayer = ({
    previewUrl,
    autoPlay = true,
    startedAt,
}: UseSyncedAudioPlayerOptions) => {
    // updateInterval : on n'affiche ni la position ni la durée, juste
    // isLoaded/playing. Sur iOS, status.playing ne se met à jour qu'à chaque
    // tick de cet intervalle (pas d'event immédiat comme sur Android), donc
    // il peut rester bloqué sur false alors que le son joue déjà. C'était la
    // vraie cause de la désynchro entre iPhones : le filet de rattrapage plus
    // bas relançait play() pour rien en se basant sur cette valeur en retard.
    const player = useAudioPlayer(previewUrl ?? null, { updateInterval: 1000 })
    const status = useAudioPlayerStatus(player)

    // Ce rattrapage (rejoindre startedAt) doit se faire qu'une seule fois par
    // extrait, pas chaque fois qu'isLoaded change. Sur Android, un seekTo()
    // refait passer isLoaded par false puis true pendant le rebuffering —
    // sans ce garde-fou ça repartait en boucle et donnait l'impression que
    // le bouton play/pause clignotait tout seul.
    const syncedForUrlRef = useRef<string | null | undefined>(undefined)

    // Passe à true seulement quand player.play() a VRAIMENT été appelé (pas
    // juste programmé) : ça sert de signal de départ pour le filet de
    // rattrapage plus bas, histoire de pas le déclencher trop tôt.
    const [hasAttempted, setHasAttempted] = useState(false)
    const [retryAttempt, setRetryAttempt] = useState(0)

    useEffect(() => {
        setHasAttempted(false)
        setRetryAttempt(0)
    }, [previewUrl])

    // Deux façons de déclencher le lancement : soit isLoaded passe à true
    // normalement, soit on force après FORCE_PLAY_TIMEOUT_MS si ça bloque.
    // Dans les deux cas c'est TOUJOURS la même logique de synchro sur
    // startedAt qui joue (attemptSyncedPlay), jamais un play() direct —
    // sinon chaque appareil démarrerait à son rythme et tout serait décalé.
    useEffect(() => {
        if (!autoPlay || syncedForUrlRef.current === previewUrl) return

        let innerTimeout: ReturnType<typeof setTimeout> | undefined

        // On marque `previewUrl` comme synchronisé seulement quand play() est
        // vraiment appelé, jamais avant. Sinon un timer en attente pouvait
        // être annulé par un re-render sans être reprogrammé, et l'extrait
        // ne se lançait plus du tout. Bug repéré en conditions réelles.
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
                // Le buffer a fini de charger après l'heure de synchro (réseau
                // lent) : on saute direct à la bonne position au lieu de
                // repartir de 0, sinon cet appareil reste décalé toute la manche.
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

    // Quand l'app revient au premier plan après une mise en veille/appel, la
    // session audio iOS repart parfois cassée : reconfigurer le mode (voir
    // useAudioModeSetup) ne suffit pas à elle seule, le lecteur DÉJÀ créé
    // avant la mise en veille reste silencieux tant qu'on ne relance pas
    // play() dessus explicitement — même si status.playing dit encore true.
    // C'est ce qui donnait l'impression que "tout est activé" mais qu'aucun
    // son ne sortait après avoir verrouillé le téléphone entre deux manches.
    useEffect(() => {
        const appState = { current: AppState.currentState }
        const subscription = AppState.addEventListener('change', (nextState: AppStateStatus) => {
            const cameBackToForeground = appState.current !== 'active' && nextState === 'active'
            appState.current = nextState
            if (!cameBackToForeground) return
            if (!autoPlay || syncedForUrlRef.current !== previewUrl) return

            configureAudioMode().then(() => {
                player.play()
            })
        })
        return () => subscription.remove()
    }, [autoPlay, previewUrl, player])

    // Filet de rattrapage : si on a demandé la lecture (hasAttempted) mais
    // que status.playing ne passe jamais à true, on retente nous-mêmes, un
    // nombre de fois limité (cf. constantes en haut de fichier).
    useEffect(() => {
        if (!autoPlay || !hasAttempted || status.playing) return
        if (retryAttempt >= AUTOPLAY_MAX_RETRIES) return

        const timeout = setTimeout(() => {
            // `player.playing` c'est l'état natif en direct, sans le retard
            // de status.playing (cf. plus haut). Sans ce re-check, on aurait
            // relancé play() sur un iPhone qui jouait déjà, et désynchro
            // l'appareil pour rien.
            if (player.playing) {
                setRetryAttempt((n) => n + 1)
                return
            }

            // Toutes les 3 tentatives, on tape plus fort : seekTo(0) avant
            // play(), parce qu'un simple play() suffit pas toujours à
            // débloquer le lecteur. Même repli que restartPreview côté
            // game.screen.tsx pour un souci similaire.
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
