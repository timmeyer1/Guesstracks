import React from 'react'
import { View, Text, TouchableOpacity } from 'react-native'
import { Volume2, VolumeX, Music } from 'lucide-react-native'
import { COLORS } from '../../core/constants/colors.constants'

type AudioPlayerButtonProps = {
    previewUrl?: string | null
    // son coupé ou non — PAS un état "en lecture/en pause" : l'extrait se
    // lance toujours tout seul (cf. useSyncedAudioPlayer), il n'y a plus de
    // contrôle manuel de la lecture, seulement du son
    muted: boolean
    onToggleMute: () => void
    // couleur de fond du bouton, claire par défaut (comme la pastille
    // StatusPill "Temps restant" à côté de laquelle il est souvent affiché)
    color?: string
    // bouton plus petit, utilisé quand l'espace vertical est précieux (ex:
    // recherche du blindtest, au-dessus du clavier)
    compact?: boolean
}

// Partie purement visuelle du lecteur (bouton muet/son + état "pas
// d'extrait"), sans état audio propre : reçoit `muted`/`onToggleMute` d'un
// lecteur partagé (cf. useSyncedAudioPlayer) — permet à game.screen.tsx
// d'afficher ce bouton à plusieurs endroits (question, résultat de manche)
// tout en gardant une seule instance audio native derrière, pour ne jamais
// interrompre/recharger l'extrait au changement d'écran.
//
// Pas de bouton play/pause manuel (ancienne version) : sur certains Android
// peu puissants, la lecture automatique pouvait rater silencieusement, et le
// bouton play servait alors de rattrapage manuel. Ce rattrapage se fait
// désormais tout seul (cf. useSyncedAudioPlayer, qui retente automatiquement
// si la lecture n'a pas démarré) — le seul contrôle qui reste au joueur est
// de couper le son, une préférence qui reste active manche après manche
// jusqu'à ce qu'il la désactive lui-même.
export const AudioPlayerButton: React.FC<AudioPlayerButtonProps> = ({
    previewUrl,
    muted,
    onToggleMute,
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
                onPress={onToggleMute}
                className={`rounded-full ${buttonSizeClass} items-center justify-center`}
                style={{ backgroundColor: color }}
            >
                {muted ? (
                    <VolumeX size={iconSize} color={COLORS.dark} />
                ) : (
                    <Volume2 size={iconSize} color={COLORS.dark} />
                )}
            </TouchableOpacity>
        </View>
    )
}
