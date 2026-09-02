import React from 'react'
import { View, Text, TouchableOpacity } from 'react-native'
import { Play, Pause, Music } from 'lucide-react-native'
import { COLORS } from '../../core/constants/colors.constants'

type AudioPlayerButtonProps = {
    previewUrl?: string | null
    playing: boolean
    onToggle: () => void
    // couleur de fond du bouton, claire par défaut (comme la pastille
    // StatusPill "Temps restant" à côté de laquelle il est souvent affiché)
    color?: string
    // bouton plus petit, utilisé quand l'espace vertical est précieux (ex:
    // recherche du blindtest, au-dessus du clavier)
    compact?: boolean
}

// Partie purement visuelle du lecteur (bouton play/pause + état "pas
// d'extrait"), sans état audio propre : reçoit `playing`/`onToggle` d'un
// lecteur partagé (cf. useSyncedAudioPlayer) — permet à game.screen.tsx
// d'afficher ce bouton à plusieurs endroits (question, résultat de manche)
// tout en gardant une seule instance audio native derrière, pour ne jamais
// interrompre/recharger l'extrait au changement d'écran.
//
// Un bouton muet (sans play/pause) a été essayé un temps, en s'appuyant
// uniquement sur le rattrapage automatique de useSyncedAudioPlayer : sur
// certains Android, l'extrait n'a pas toujours le temps de charger avant
// que ce rattrapage abandonne, laissant le joueur sans aucun recours. Le
// bouton play/pause manuel reste donc le filet de secours ultime.
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

    // w-11 h-11 (44px) en compact : même hauteur que la pastille StatusPill
    // "Temps restant" à côté de laquelle ce bouton est affiché (cf.
    // game.screen.tsx, en-tête de la manche en mode blindtest), pour que
    // les deux forment un ensemble cohérent
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
