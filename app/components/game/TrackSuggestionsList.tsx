import React, { useCallback, useEffect } from 'react'
import { View, Text } from 'react-native'
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated'
import { Image } from 'expo-image'
import { cssInterop } from 'nativewind'
// FlatList/TouchableOpacity de gesture-handler et pas de react-native : ça
// gère mieux le scroll sur Android, où le menu restait sinon bloqué sur
// certains téléphones (Xiaomi notamment)
import { FlatList, TouchableOpacity } from 'react-native-gesture-handler'
import { Music } from 'lucide-react-native'
import { COLORS } from '../../core/constants/colors.constants'
import type { CatalogEntry } from '../../core/types'

// sans ça, className marche pas sur ce TouchableOpacity (celui de
// gesture-handler, NativeWind le connaît pas par défaut)
cssInterop(TouchableOpacity, { className: 'style' })

type TrackSuggestionsListProps = {
    suggestions: CatalogEntry[]
    onSelect: (id: string) => void
}

const MENU_MAX_HEIGHT = 288
const OPEN_ANIMATION_MS = 180

// ligne mémoïsée, se re-rend que si son track ou onSelect change vraiment
type SuggestionRowProps = { track: CatalogEntry; onSelect: (id: string) => void }
const SuggestionRow: React.FC<SuggestionRowProps> = React.memo(function SuggestionRow({ track, onSelect }) {
    return (
        <TouchableOpacity
            onPress={() => onSelect(track.id)}
            className="flex-row items-center p-3 border-b border-offwhite"
        >
            {track.image ? (
                <Image
                    source={{ uri: track.image }}
                    style={{ width: 40, height: 40, borderRadius: 8 }}
                    cachePolicy="memory-disk"
                    transition={100}
                />
            ) : (
                <View
                    className="bg-offwhite items-center justify-center"
                    style={{ width: 40, height: 40, borderRadius: 8 }}
                >
                    <Music size={16} color={COLORS.darkgray} />
                </View>
            )}
            <View className="flex-1 ml-3">
                <Text className="text-black font-semibold" numberOfLines={1}>
                    {track.name}
                </Text>
                <Text className="text-darkgray text-sm" numberOfLines={1}>
                    {track.artist}
                </Text>
            </View>
        </TouchableOpacity>
    )
})

// menu de suggestions du blindtest, avec juste un fondu à l'ouverture (pas
// de glissement en plus, en mode ça casse le scroll de la liste sur Android)
export const TrackSuggestionsList: React.FC<TrackSuggestionsListProps> = React.memo(function TrackSuggestionsList({
    suggestions,
    onSelect,
}) {
    const openAnim = useSharedValue(0)

    useEffect(() => {
        openAnim.value = withTiming(1, { duration: OPEN_ANIMATION_MS })
    }, [openAnim])

    const animatedStyle = useAnimatedStyle(() => ({
        opacity: openAnim.value,
    }))

    const renderItem = useCallback(
        ({ item: track }: { item: CatalogEntry }) => <SuggestionRow track={track} onSelect={onSelect} />,
        [onSelect]
    )

    return (
        // l'ombre et le overflow-hidden doivent être sur deux Views séparées,
        // sinon l'ombre s'affiche pas (et sur Android ça casse le scroll)
        <Animated.View
            className="absolute left-0 right-0 bottom-full mb-2 rounded-2xl shadow-card"
            style={[{ maxHeight: MENU_MAX_HEIGHT, elevation: 6 }, animatedStyle]}
        >
            <View className="bg-white rounded-2xl overflow-hidden" style={{ maxHeight: MENU_MAX_HEIGHT }}>
                {/* FlatList et pas ScrollView : ne monte que les lignes visibles à
                l'écran, dcp ça reste fluide même avec un gros catalogue */}
                <FlatList
                    // hauteur explicite, sinon sur Android la liste devient non
                    // scrollable (elle mesure sa hauteur sur son contenu)
                    style={{ maxHeight: MENU_MAX_HEIGHT }}
                    // à false sinon ça casse le scroll sur Android dans ce menu flottant
                    removeClippedSubviews={false}
                    // sur Android sans ça le scroll marche pas (l'écran parent
                    // pique le geste avant la liste)
                    nestedScrollEnabled
                    data={suggestions}
                    keyExtractor={(track) => track.id}
                    keyboardShouldPersistTaps="handled"
                    showsVerticalScrollIndicator={false}
                    initialNumToRender={8}
                    windowSize={5}
                    renderItem={renderItem}
                    ListEmptyComponent={
                        <Text className="text-darkgray text-sm text-center p-4">
                            Aucun titre trouvé
                        </Text>
                    }
                />
            </View>
        </Animated.View>
    )
})
