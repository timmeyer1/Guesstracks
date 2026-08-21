import React, { useMemo, useState } from 'react'
import { View, Text, TextInput, TouchableOpacity, ScrollView } from 'react-native'
import { Search, Check } from 'lucide-react-native'
import { COLORS } from '../../core/constants/colors.constants'
import { useCountdown } from '../../core/hooks/useCountdown'
import { StatusPill } from '../StatusPill'
import type { CatalogEntry } from '../../core/types'

type SearchTrackQuestionProps = {
    catalog: CatalogEntry[]
    hasAnswered: boolean
    selectedId: string | null
    startedAt: number
    duration: number
    onAnswer: (id: string) => void
}

const MIN_QUERY_LENGTH = 2
const MAX_SUGGESTIONS = 6

// insensible à la casse et aux accents, pour que "orleans" trouve "Orléans"
const DIACRITICS_RANGE = new RegExp('[\\u0300-\\u036f]', 'g')
const normalize = (value: string) =>
    value
        .normalize('NFD')
        .replace(DIACRITICS_RANGE, '')
        .toLowerCase()
        .trim()

export const SearchTrackQuestion: React.FC<SearchTrackQuestionProps> = ({
    catalog,
    hasAnswered,
    selectedId,
    startedAt,
    duration,
    onAnswer,
}) => {
    const [query, setQuery] = useState('')
    const { remaining } = useCountdown(startedAt, duration)

    // recherche sur le titre ET l'artiste (chercher juste par titre était
    // trop difficile en pratique) ; les correspondances par titre sont
    // classées avant celles par artiste seul
    const suggestions = useMemo(() => {
        const normalizedQuery = normalize(query)
        if (normalizedQuery.length < MIN_QUERY_LENGTH) return []

        const nameStartsWith: CatalogEntry[] = []
        const nameContains: CatalogEntry[] = []
        const artistMatches: CatalogEntry[] = []

        for (const track of catalog) {
            const normalizedName = normalize(track.name)
            const normalizedArtist = normalize(track.artist)

            if (normalizedName.startsWith(normalizedQuery)) nameStartsWith.push(track)
            else if (normalizedName.includes(normalizedQuery)) nameContains.push(track)
            else if (normalizedArtist.includes(normalizedQuery)) artistMatches.push(track)
        }

        return [...nameStartsWith, ...nameContains, ...artistMatches].slice(0, MAX_SUGGESTIONS)
    }, [query, catalog])

    const selectedTrack = selectedId ? catalog.find((t) => t.id === selectedId) : null

    const handleSelect = (id: string) => {
        if (hasAnswered) return
        onAnswer(id)
    }

    if (hasAnswered) {
        return (
            <View className="bg-offwhite rounded-2xl p-4 items-center">
                <Text className="text-darkgray text-sm mb-1">Réponse envoyée</Text>
                <Text className="text-black font-bold text-base text-center">
                    {selectedTrack ? selectedTrack.name : 'Aucune réponse'}
                </Text>
            </View>
        )
    }

    const showDropdown = query.trim().length >= MIN_QUERY_LENGTH

    return (
        <View>
            <Text className="text-black text-lg font-bold text-center mb-3">
                Quelle est cette musique ?
            </Text>

            <View className="items-center mb-3">
                <StatusPill text={`Temps restant : ${remaining}s`} />
            </View>

            {/* zIndex élevé pour que le dropdown flotte au-dessus du reste du
            contenu au lieu de pousser la mise en page (sinon gros vide tant
            que rien n'est tapé) */}
            <View style={{ zIndex: 10 }}>
                <View className="flex-row items-center bg-offwhite rounded-2xl px-4 py-3">
                    <Search size={18} color={COLORS.darkgray} />
                    <TextInput
                        className="flex-1 ml-2 text-black text-base"
                        value={query}
                        onChangeText={setQuery}
                        placeholder="Cherche un titre ou un artiste..."
                        placeholderTextColor={COLORS.darkgray}
                        autoCapitalize="none"
                        autoCorrect={false}
                    />
                </View>

                {showDropdown && (
                    <View
                        className="absolute left-0 right-0 top-full mt-2 bg-white rounded-2xl shadow-card overflow-hidden"
                        style={{ maxHeight: 240, elevation: 6 }}
                    >
                        <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
                            {suggestions.map((track) => (
                                <TouchableOpacity
                                    key={track.id}
                                    onPress={() => handleSelect(track.id)}
                                    className="flex-row items-center justify-between p-3 border-b border-offwhite"
                                >
                                    <View className="flex-1 pr-2">
                                        <Text className="text-black font-semibold" numberOfLines={1}>
                                            {track.name}
                                        </Text>
                                        <Text className="text-darkgray text-sm" numberOfLines={1}>
                                            {track.artist}
                                        </Text>
                                    </View>
                                    <Check size={18} color={COLORS.blindtest} />
                                </TouchableOpacity>
                            ))}

                            {suggestions.length === 0 && (
                                <Text className="text-darkgray text-sm text-center p-3">
                                    Aucun titre trouvé
                                </Text>
                            )}
                        </ScrollView>
                    </View>
                )}
            </View>
        </View>
    )
}
