import React, { useEffect } from 'react'
import { View, Text } from 'react-native'
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated'
import { COLORS } from '../../core/constants/colors.constants'
import { useCountdown } from '../../core/hooks/useCountdown'
import type { GameMode } from '../../core/types'

type RoundHeaderProps = {
    roundIndex: number
    totalRounds: number
    startedAt: number
    duration: number // secondes
    gameMode: GameMode | null
    /** N'affiche que "Manche X/Y" : utilisé quand le décompte est déjà affiché ailleurs (ex: StatusPill "Temps restant"). */
    compact?: boolean
}

// Deux composants séparés (plutôt qu'un `if (compact) return` avant les hooks
// de décompte/animation) : ça évite tout risque de violation des règles des
// hooks si `compact` venait un jour à changer pendant la vie du composant.
export const RoundHeader: React.FC<RoundHeaderProps> = (props) =>
    props.compact ? (
        <RoundHeaderCompact roundIndex={props.roundIndex} totalRounds={props.totalRounds} />
    ) : (
        <RoundHeaderFull {...props} />
    )

const RoundHeaderCompact: React.FC<Pick<RoundHeaderProps, 'roundIndex' | 'totalRounds'>> = ({
    roundIndex,
    totalRounds,
}) => (
    <Text className="text-black font-bold text-base text-center mb-4">
        Manche {roundIndex + 1}/{totalRounds}
    </Text>
)

const RoundHeaderFull: React.FC<RoundHeaderProps> = ({
    roundIndex,
    totalRounds,
    startedAt,
    duration,
    gameMode,
}) => {
    const { remaining } = useCountdown(startedAt, duration)
    const accentColor = gameMode === 'blindtest' ? COLORS.blindtest : COLORS.guesstracks

    // Barre animée sur le thread UI (transform, pas de layout) : aucun
    // re-render React entre le début et la fin de la manche.
    const progress = useSharedValue(1)
    useEffect(() => {
        progress.value = 1
        progress.value = withTiming(0, { duration: duration * 1000, easing: Easing.linear })
    }, [startedAt, duration, progress])

    const barStyle = useAnimatedStyle(() => ({
        transform: [{ scaleX: progress.value }],
    }))

    return (
        <View className="mb-4">
            <View className="flex-row justify-between items-center mb-2">
                <Text className="text-black font-bold text-base">
                    Manche {roundIndex + 1}/{totalRounds}
                </Text>
                <Text className="text-darkgray font-semibold text-base">{remaining}s</Text>
            </View>
            <View className="w-full h-2 bg-offwhite rounded-full overflow-hidden">
                <Animated.View
                    className="h-full rounded-full"
                    style={[{ backgroundColor: accentColor, transformOrigin: 'left' }, barStyle]}
                />
            </View>
        </View>
    )
}
