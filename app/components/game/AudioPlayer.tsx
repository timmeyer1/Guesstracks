import React, { useEffect } from 'react'
import { View, Text, TouchableOpacity } from 'react-native'
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio'
import { Play, Pause, Music } from 'lucide-react-native'
import { COLORS } from '../../core/constants/colors.constants'

type AudioPlayerProps = {
    previewUrl?: string | null
    autoPlay?: boolean
    color?: string
}

// `useAudioPlayer` recrée l'instance native dès que `previewUrl` change et
// libère l'ancienne automatiquement (cf. expo-audio), donc pas de nettoyage
// manuel à faire ici entre deux manches.
export const AudioPlayer: React.FC<AudioPlayerProps> = ({
    previewUrl,
    autoPlay = true,
    color = COLORS.primary,
}) => {
    const player = useAudioPlayer(previewUrl ?? null)
    const status = useAudioPlayerStatus(player)

    useEffect(() => {
        if (autoPlay && status.isLoaded) {
            player.play()
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [status.isLoaded])

    if (!previewUrl) {
        return (
            <View className="bg-offwhite rounded-3xl p-6 items-center justify-center">
                <Music size={32} color={COLORS.darkgray} />
                <Text className="text-darkgray text-sm mt-2 text-center">
                    Pas d'extrait disponible pour cette musique, fie-toi à tes souvenirs !
                </Text>
            </View>
        )
    }

    const progress = status.duration > 0 ? Math.min(1, status.currentTime / status.duration) : 0

    const togglePlayback = () => {
        if (status.playing) player.pause()
        else player.play()
    }

    return (
        <View className="bg-offwhite rounded-3xl p-6 items-center">
            <TouchableOpacity
                onPress={togglePlayback}
                className="rounded-full w-16 h-16 items-center justify-center mb-3"
                style={{ backgroundColor: color }}
            >
                {status.playing ? (
                    <Pause size={28} color={COLORS.white} fill={COLORS.white} />
                ) : (
                    <Play size={28} color={COLORS.white} fill={COLORS.white} />
                )}
            </TouchableOpacity>

            <View className="w-full h-1.5 bg-white rounded-full overflow-hidden">
                <View
                    className="h-full rounded-full"
                    style={{ width: `${progress * 100}%`, backgroundColor: color }}
                />
            </View>
        </View>
    )
}
