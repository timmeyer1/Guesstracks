// app/core/hooks/useSyncedAudioPlayer.types.ts
export type UseSyncedAudioPlayerOptions = {
    previewUrl?: string | null
    autoPlay?: boolean
    // Timestamp serveur : l'heure à laquelle tout le monde doit démarrer la
    // lecture en même temps. Sans ça, chacun démarre dès que son buffer est
    // prêt, et le son est décalé d'un appareil à l'autre.
    startedAt?: number
}

// Ce que les deux implémentations (native et web) renvoient en commun —
// juste ce dont game.screen.tsx & co ont vraiment besoin.
export type SyncedAudioPlayer = {
    player: {
        play: () => void
        pause: () => void
        seekTo: (seconds: number) => Promise<void>
    }
    status: {
        playing: boolean
        isLoaded: boolean
        didJustFinish: boolean
    }
    toggle: () => void
}
