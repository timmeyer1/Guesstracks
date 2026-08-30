import React from 'react'
import { View, Text, TouchableOpacity, ScrollView } from 'react-native'
import { Image } from 'expo-image'
import { Check } from 'lucide-react-native'
import { COLORS } from '../../core/constants/colors.constants'
import { CustomButton } from '../Button'
import type { WhoLikedOption } from '../../core/types'

type WhoLikedQuestionProps = {
    options: WhoLikedOption[]
    selected: string[]
    hasAnswered: boolean
    onToggle: (id: string) => void
    onSubmit: () => void
}

// Ligne mémoïsée : ne re-rend que si son propre `isSelected`/`isDimmed`
// change, pas à chaque render de la grille entière (ex: à chaque tick du
// countdown, cf. CountdownLabel) — `onToggle` doit rester une référence
// stable côté appelant (cf. audit qualité, finding N4).
type OptionRowProps = {
    option: WhoLikedOption
    isSelected: boolean
    isDimmed: boolean
    hasAnswered: boolean
    onToggle: (id: string) => void
}
const OptionRow: React.FC<OptionRowProps> = React.memo(function OptionRow({
    option,
    isSelected,
    isDimmed,
    hasAnswered,
    onToggle,
}) {
    return (
        <TouchableOpacity
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
                        style={{ backgroundColor: COLORS.who_liked }}
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
})

export const WhoLikedQuestion: React.FC<WhoLikedQuestionProps> = ({
    options,
    selected,
    hasAnswered,
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

            <ScrollView
                contentContainerStyle={{ flexGrow: 1 }}
                showsVerticalScrollIndicator={false}
                // Android uniquement : sans ça, le conteneur natif de l'écran
                // (react-native-screens) intercepte le geste de glissement
                // vertical avant que cette ScrollView ne le récupère, même
                // sans ScrollView parent visible côté JS (cf. même bug déjà
                // rencontré sur TrackSuggestionsList) — la liste reste
                // affichée mais ne réagit à aucun glissement
                nestedScrollEnabled
            >
                <View className="flex-row flex-wrap justify-between gap-y-3">
                    {options.map((option) => (
                        <OptionRow
                            key={option.id}
                            option={option}
                            isSelected={selected.includes(option.id)}
                            isDimmed={hasAnswered && !selected.includes(option.id)}
                            hasAnswered={hasAnswered}
                            onToggle={onToggle}
                        />
                    ))}
                </View>
            </ScrollView>

            <View className="mt-4">
                <CustomButton
                    name={hasAnswered ? 'Réponse envoyée' : 'Valider'}
                    onPress={onSubmit}
                    available={!hasAnswered && selected.length > 0}
                    variant="dark"
                />
            </View>
        </View>
    )
}
