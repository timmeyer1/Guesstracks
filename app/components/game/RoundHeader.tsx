import React, { useEffect, useState } from 'react'
import { View, Text } from 'react-native'
import { COLORS } from '../../core/constants/colors.constants'
import type { GameMode } from '../../core/types'

type RoundHeaderProps = {
    roundIndex: number
    totalRounds: number
    startedAt: number
    duration: number // secondes
    gameMode: GameMode | null
}

export const RoundHeader: React.FC<RoundHeaderProps> = ({
    roundIndex,
    totalRounds,
    startedAt,
    duration,
    gameMode,
}) => {
    const [now, setNow] = useState(Date.now())

    useEffect(() => {
        setNow(Date.now())
        const interval = setInterval(() => setNow(Date.now()), 100)
        return () => clearInterval(interval)
    }, [startedAt])

    const durationMs = duration * 1000
    const elapsed = Math.min(durationMs, Math.max(0, now - startedAt))
    const remaining = Math.max(0, Math.ceil((durationMs - elapsed) / 1000))
    const progress = Math.max(0, 1 - elapsed / durationMs)
    const accentColor = gameMode === 'blindtest' ? COLORS.blindtest : COLORS.guesstracks

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
