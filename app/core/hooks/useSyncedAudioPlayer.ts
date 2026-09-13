// app/core/hooks/useSyncedAudioPlayer.ts
import { Platform } from 'react-native'
import { useNativeSyncedAudioPlayer } from './useNativeSyncedAudioPlayer'
import { useWebSyncedAudioPlayer } from './useWebSyncedAudioPlayer'
import type { SyncedAudioPlayer, UseSyncedAudioPlayerOptions } from './useSyncedAudioPlayer.types'

export type { UseSyncedAudioPlayerOptions } from './useSyncedAudioPlayer.types'

// En gros, le web ne peut pas réutiliser la version native (expo-audio) :
// sur Safari iOS, chaque nouvel extrait redemande un geste utilisateur, donc
// à partir de la 2e manche ça reste muet. La version web contourne ça avec
// l'AudioContext, débloqué une fois pour toute la session.
//
// On choisit la bonne implémentation une seule fois au chargement du module
// (Platform.OS ne change jamais), pour respecter la règle des hooks : jamais
// deux hooks différents appelés selon une condition.
export const useSyncedAudioPlayer: (options: UseSyncedAudioPlayerOptions) => SyncedAudioPlayer =
    Platform.OS === 'web' ? useWebSyncedAudioPlayer : useNativeSyncedAudioPlayer
