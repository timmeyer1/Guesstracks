import React from 'react'
import { View, Text, TouchableOpacity } from 'react-native'
import { COLORS } from '../../core/constants/colors.constants'
import type { GuessTrackOption } from '../../core/types'

type GuessTrackOptionsProps = {
    options: GuessTrackOption[]
    selected: string[]
    hasAnswered: boolean
    onAnswer: (id: string) => void
}

export const GuessTrackOptions: React.FC<GuessTrackOptionsProps> = ({
    options,
    selected,
    hasAnswered,
    onAnswer,
}) => {
    return (
        <View className="flex-1">
            <Text className="text-black text-lg font-bold text-center mb-4">
                Quelle est cette musique ?
            </Text>

            <View className="gap-3">
                {options.map((option) => {
                    const isSelected = selected.includes(option.id)
                    return (
                        <TouchableOpacity
                            key={option.id}
                            onPress={() => !hasAnswered && onAnswer(option.id)}
                            disabled={hasAnswered}
                            className="rounded-2xl p-4"
                            style={{
                                backgroundColor: isSelected ? COLORS.blindtest : COLORS.offwhite,
                                opacity: hasAnswered && !isSelected ? 0.4 : 1,
                            }}
                        >
                            <Text
                                className="font-semibold text-base"
                                style={{ color: isSelected ? COLORS.white : COLORS.dark }}
                            >
                                {option.label}
                            </Text>
                        </TouchableOpacity>
                    )
                })}
            </View>
        </View>
    )
}
