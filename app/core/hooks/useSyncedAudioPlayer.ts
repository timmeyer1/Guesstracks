// app/core/hooks/useSyncedAudioPlayer.ts
import { Platform } from 'react-native'
import { useNativeSyncedAudioPlayer } from './useNativeSyncedAudioPlayer'
import { useWebSyncedAudioPlayer } from './useWebSyncedAudioPlayer'
import type { SyncedAudioPlayer, UseSyncedAudioPlayerOptions } from './useSyncedAudioPlayer.types'

export type { UseSyncedAudioPlayerOptions } from './useSyncedAudioPlayer.types'

// Web ne peut pas réutiliser l'implémentation native (expo-audio) : sur iOS
// Safari, un <audio> HTMLMediaElement exige un geste utilisateur pour CHAQUE
// nouvel élément créé, alors qu'expo-audio en recrée un nouveau à chaque
// manche (previewUrl qui change) — testé en conditions réelles : les manches
// suivant la toute première restent silencieuses, quel que soit le
// déblocage tenté en amont. useWebSyncedAudioPlayer contourne ça en passant
// par l'AudioContext (Web Audio API), débloqué une seule fois pour toute la
// session (cf. webAudioUnlock.ts) et réutilisé pour toutes les lectures
// programmées ensuite, sans jamais redemander de geste.
//
// Choisi une seule fois au chargement du module plutôt qu'appelé
// conditionnellement dans le corps du hook : Platform.OS ne change jamais en
// cours de session, donc `useSyncedAudioPlayer` désigne toujours la MÊME
// fonction pour tous les composants qui l'utilisent — la règle des hooks
// (un seul hook appelé, jamais deux en fonction d'une condition) reste
// respectée.
export const useSyncedAudioPlayer: (options: UseSyncedAudioPlayerOptions) => SyncedAudioPlayer =
    Platform.OS === 'web' ? useWebSyncedAudioPlayer : useNativeSyncedAudioPlayer
