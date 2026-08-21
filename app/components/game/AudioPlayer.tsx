import React, { useEffect } from 'react'
import { View, Text, TouchableOpacity } from 'react-native'
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio'
import { Play, Pause, Music } from 'lucide-react-native'
import { COLORS } from '../../core/constants/colors.constants'

type AudioPlayerProps = {
    previewUrl?: string | null
    autoPlay?: boolean
    // couleur de fond du bouton, claire par défaut (comme la pastille
    // StatusPill "Temps restant" à côté de laquelle il est souvent affiché)
    color?: string
    // bouton plus petit, utilisé quand l'espace vertical est précieux (ex:
    // recherche du blindtest, au-dessus du clavier)
    compact?: boolean
}

// `useAudioPlayer` recrée l'instance native dès que `previewUrl` change et
// libère l'ancienne automatiquement (cf. expo-audio), donc pas de nettoyage
// manuel à faire ici entre deux manches.
export const AudioPlayer: React.FC<AudioPlayerProps> = ({
    previewUrl,
    autoPlay = true,
    color = COLORS.offwhite,
    compact = false,
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
        if (compact) {
            return (
                <View className="bg-offwhite rounded-2xl px-4 py-3 flex-row items-center">
                    <Music size={18} color={COLORS.darkgray} />
                    <Text className="text-darkgray text-xs ml-2 flex-1" numberOfLines={2}>
                        Pas d'extrait disponible, fie-toi à tes souvenirs !
                    </Text>
                </View>
            )
        }
        return (
            <View className="bg-offwhite rounded-3xl p-6 items-center justify-center">
                <Music size={32} color={COLORS.darkgray} />
                <Text className="text-darkgray text-sm mt-2 text-center">
                    Pas d'extrait disponible pour cette musique, fie-toi à tes souvenirs !
                </Text>
            </View>
        )
    }

    const togglePlayback = () => {
        if (status.playing) player.pause()
        else player.play()
    }

    // w-11 h-11 (44px) en compact : même hauteur que la pastille StatusPill
    // "Temps restant" à côté de laquelle ce bouton est affiché (cf.
    // game.screen.tsx, en-tête de la manche en mode blindtest), pour que
    // les deux forment un ensemble cohérent
    const buttonSizeClass = compact ? 'w-11 h-11' : 'w-16 h-16'
    const iconSize = compact ? 20 : 28

    return (
        <View className="items-center">
            <TouchableOpacity
                onPress={togglePlayback}
                className={`rounded-full ${buttonSizeClass} items-center justify-center`}
                style={{ backgroundColor: color }}
            >
                {status.playing ? (
                    <Pause size={iconSize} color={COLORS.dark} fill={COLORS.dark} />
                ) : (
                    <Play size={iconSize} color={COLORS.dark} fill={COLORS.dark} />
                )}
            </TouchableOpacity>
        </View>
    )
}
