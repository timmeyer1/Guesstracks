import React from 'react'
import { View, Text, TouchableOpacity, ScrollView } from 'react-native'
import { Check } from 'lucide-react-native'
import { COLORS } from '../../core/constants/colors.constants'
import { PlayerAvatar } from '../lobby/PlayerAvatar'
import { CustomButton } from '../Button'
import type { WhoLikedOption } from '../../core/types'

type WhoLikedQuestionProps = {
    options: WhoLikedOption[]
    selected: string[]
    hasAnswered: boolean
    onToggle: (id: string) => void
    onSubmit: () => void
}

export const WhoLikedQuestion: React.FC<WhoLikedQuestionProps> = ({
    options,
    selected,
    hasAnswered,
    onToggle,
    onSubmit,
}) => {
    return (
        <View className="flex-1">
            <Text className="text-black text-lg font-bold text-center mb-4">
                Qui a liké cette musique ?
            </Text>

            <ScrollView contentContainerStyle={{ flexGrow: 1 }} showsVerticalScrollIndicator={false}>
                <View className="flex-row flex-wrap justify-center gap-4">
                    {options.map((option) => {
                        const isSelected = selected.includes(option.id)
                        return (
                            <TouchableOpacity
                                key={option.id}
                                onPress={() => !hasAnswered && onToggle(option.id)}
                                disabled={hasAnswered}
                                className="items-center"
                                style={{ width: 80, opacity: hasAnswered && !isSelected ? 0.4 : 1 }}
                            >
                                <View className="relative">
                                    <PlayerAvatar
                                        name={option.name}
                                        img={option.img ?? undefined}
                                        isHost={false}
                                        size="md"
                                    />
                                    {isSelected && (
                                        <View
                                            className="absolute -top-1 -right-1 rounded-full p-1"
                                            style={{ backgroundColor: COLORS.guesstracks }}
                                        >
                                            <Check size={14} color={COLORS.white} />
                                        </View>
                                    )}
                                </View>
                            </TouchableOpacity>
                        )
                    })}
                </View>
            </ScrollView>

            <CustomButton
                name={hasAnswered ? 'Réponse envoyée' : 'Valider'}
                onPress={onSubmit}
                available={!hasAnswered && selected.length > 0}
                variant="dark"
            />
        </View>
    )
}
