import React from 'react'
import { View, Text } from 'react-native'
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

export const RoundHeader: React.FC<RoundHeaderProps> = ({
    roundIndex,
    totalRounds,
    startedAt,
    duration,
    gameMode,
    compact = false,
}) => {
    const { remaining, progress } = useCountdown(startedAt, duration)
    const accentColor = gameMode === 'blindtest' ? COLORS.blindtest : COLORS.guesstracks

    if (compact) {
        return (
            <Text className="text-black font-bold text-base text-center mb-4">
                Manche {roundIndex + 1}/{totalRounds}
            </Text>
        )
    }

    return (
        <View className="mb-4">
            <View className="flex-row justify-between items-center mb-2">
                <Text className="text-black font-bold text-base">
                    Manche {roundIndex + 1}/{totalRounds}
                </Text>
                <Text className="text-darkgray font-semibold text-base">{remaining}s</Text>
            </View>
            <View className="w-full h-2 bg-offwhite rounded-full overflow-hidden">
                <View
                    className="h-full rounded-full"
                    style={{ width: `${progress * 100}%`, backgroundColor: accentColor }}
                />
            </View>
        </View>
    )
}
