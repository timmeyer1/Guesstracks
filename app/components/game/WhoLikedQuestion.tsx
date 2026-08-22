import React from 'react'
import { View, Text, TouchableOpacity, ScrollView } from 'react-native'
import { Image } from 'expo-image'
import { Check } from 'lucide-react-native'
import { COLORS } from '../../core/constants/colors.constants'
import { CustomButton } from '../Button'
import { StatusPill } from '../StatusPill'
import { CountdownLabel } from './CountdownLabel'
import type { WhoLikedOption } from '../../core/types'

type WhoLikedQuestionProps = {
    options: WhoLikedOption[]
    selected: string[]
    hasAnswered: boolean
    startedAt: number
    duration: number
    onToggle: (id: string) => void
    onSubmit: () => void
}

export const WhoLikedQuestion: React.FC<WhoLikedQuestionProps> = ({
    options,
    selected,
    hasAnswered,
    startedAt,
    duration,
    onToggle,
    onSubmit,
}) => {
    return (
        <View className="flex-1">
            <Text className="text-black text-lg font-bold text-center">
                Qui a liké cette musique ?
            </Text>
            <Text className="text-darkgray text-xs text-center mb-4">
                Plusieurs choix possibles
            </Text>

            <ScrollView contentContainerStyle={{ flexGrow: 1 }} showsVerticalScrollIndicator={false}>
                <View className="flex-row flex-wrap justify-between gap-y-3">
                    {options.map((option) => {
                        const isSelected = selected.includes(option.id)
                        const isDimmed = hasAnswered && !isSelected

                        return (
                            <TouchableOpacity
                                key={option.id}
                                onPress={() => !hasAnswered && onToggle(option.id)}
                                disabled={hasAnswered}
                                className="flex-row items-center gap-2 rounded-2xl px-3 py-2.5"
                                style={{
                                    width: '48%',
                                    opacity: isDimmed ? 0.4 : 1,
                                    backgroundColor: isSelected ? COLORS.primary + '15' : COLORS.offwhite,
                                    borderWidth: 1.5,
                                    borderColor: isSelected ? COLORS.primary : 'transparent',
                                }}
                            >
                                <View className="relative">
                                    <Image
                                        source={{ uri: option.img || 'https://i.pravatar.cc/100' }}
                                        style={{ width: 36, height: 36, borderRadius: 18 }}
                                        cachePolicy="memory-disk"
                                        transition={100}
                                    />
                                    {isSelected && (
                                        <View
                                            className="absolute -top-1 -right-1 rounded-full p-0.5"
                                            style={{ backgroundColor: COLORS.guesstracks }}
                                        >
                                            <Check size={10} color={COLORS.white} />
                                        </View>
                                    )}
                                </View>
                                <Text className="text-black font-semibold flex-1" numberOfLines={1}>
                                    {option.name}
                                </Text>
                            </TouchableOpacity>
                        )
                    })}
                </View>
            </ScrollView>

            <View className="items-center mt-4 mb-3">
                <StatusPill
                    text={
                        hasAnswered ? (
                            'En attente des autres joueurs'
                        ) : (
                            <CountdownLabel startedAt={startedAt} duration={duration} />
                        )
                    }
                />
            </View>

            <CustomButton
                name={hasAnswered ? 'Réponse envoyée' : 'Valider'}
                onPress={onSubmit}
                available={!hasAnswered && selected.length > 0}
                variant="dark"
            />
        </View>
    )
}
