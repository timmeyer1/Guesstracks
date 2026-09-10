// app/core/hooks/useSyncedAudioPlayer.types.ts
export type UseSyncedAudioPlayerOptions = {
    previewUrl?: string | null
    autoPlay?: boolean
    // timestamp serveur (Date.now() epoch, cf. round.startedAt) auquel la
    // lecture doit démarrer sur TOUS les appareils en même temps. Sans lui,
    // la lecture démarre dès que le buffer local est prêt — ce qui varie
    // selon le réseau de chaque joueur et désynchronise le son perçu d'un
    // appareil à l'autre.
    startedAt?: number
}

// Surface commune renvoyée par useNativeSyncedAudioPlayer (via expo-audio) et
// useWebSyncedAudioPlayer (via l'AudioContext partagé, cf. webAudioUnlock.ts) :
// uniquement ce que game.screen.tsx & co utilisent réellement (cf. le player
// natif d'expo-audio, bien plus riche, dont seul ce sous-ensemble est exploité).
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
