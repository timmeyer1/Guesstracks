// app/core/hooks/useSyncedAudioPlayer.ts
import { useEffect, useRef } from 'react'
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

    useEffect(() => {
        if (!autoPlay || !status.isLoaded || syncedForUrlRef.current === previewUrl) return
        syncedForUrlRef.current = previewUrl

        if (startedAt === undefined) {
            player.play()
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
            player.seekTo(clamped).then(() => player.play())
            return
        }

        const timeout = setTimeout(() => player.play(), delayMs)
        return () => clearTimeout(timeout)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [status.isLoaded, startedAt, previewUrl])

    const toggle = () => {
        if (status.playing) player.pause()
        else player.play()
    }

    return { player, status, toggle }
}
