import React from 'react'
import { View, Text, TouchableOpacity } from 'react-native'
import { Play, Pause, Music } from 'lucide-react-native'
import { COLORS } from '../../core/constants/colors.constants'

type AudioPlayerButtonProps = {
    previewUrl?: string | null
    playing: boolean
    onToggle: () => void
    // couleur de fond du bouton, claire par défaut
    color?: string
    // version plus petite du bouton, pour quand y'a pas trop de place
    compact?: boolean
}

// juste la partie visuelle (bouton play/pause), y'a pas de lecteur audio ici
// — l'état vient d'un lecteur partagé ailleurs, comme ça on peut afficher ce
// bouton à plusieurs endroits sans jamais recharger l'extrait.
// En gros on garde le bouton manuel en secours : sur certains Android
// l'auto-play foire parfois, dcp le joueur peut toujours relancer lui-même
export const AudioPlayerButton: React.FC<AudioPlayerButtonProps> = ({
    previewUrl,
    playing,
    onToggle,
    color = COLORS.offwhite,
    compact = false,
}) => {
    if (!previewUrl) {
        if (compact) {
            return (
                <View className="bg-offwhite rounded-2xl px-4 py-3 flex-row items-center flex-1">
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

    // en compact, même hauteur que la pastille "temps restant" juste à côté
    const buttonSizeClass = compact ? 'w-11 h-11' : 'w-16 h-16'
    const iconSize = compact ? 20 : 28

    return (
        <View className="items-center">
            <TouchableOpacity
                onPress={onToggle}
                className={`rounded-full ${buttonSizeClass} items-center justify-center`}
                style={{ backgroundColor: color }}
            >
                {playing ? (
                    <Pause size={iconSize} color={COLORS.dark} fill={COLORS.dark} />
                ) : (
                    <Play size={iconSize} color={COLORS.dark} fill={COLORS.dark} />
                )}
            </TouchableOpacity>
        </View>
    )
}
