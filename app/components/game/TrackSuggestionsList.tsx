import React, { useEffect, useRef } from 'react'
import { Animated, View, Text, TouchableOpacity, Image, FlatList } from 'react-native'
import { Check, Music } from 'lucide-react-native'
import { COLORS } from '../../core/constants/colors.constants'
import type { CatalogEntry } from '../../core/types'

type TrackSuggestionsListProps = {
    suggestions: CatalogEntry[]
    onSelect: (id: string) => void
}

const MENU_MAX_HEIGHT = 288
const OPEN_ANIMATION_MS = 180

// Menu de suggestions du blindtest : remonté à chaque fois que la recherche
// redevient assez longue (cf. SearchTrackQuestion), donc un simple fondu +
// léger glissement au montage suffit à donner l'impression d'un menu qui
// s'ouvre plutôt que d'un bloc qui apparaît d'un coup.
export const TrackSuggestionsList: React.FC<TrackSuggestionsListProps> = ({ suggestions, onSelect }) => {
    const openAnim = useRef(new Animated.Value(0)).current

    useEffect(() => {
        Animated.timing(openAnim, {
            toValue: 1,
            duration: OPEN_ANIMATION_MS,
            useNativeDriver: true,
        }).start()
    }, [openAnim])

    return (
        <Animated.View
            className="absolute left-0 right-0 bottom-full mb-2 bg-white rounded-2xl shadow-card overflow-hidden"
            style={{
                maxHeight: MENU_MAX_HEIGHT,
                elevation: 6,
                opacity: openAnim,
                transform: [{ translateY: openAnim.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }],
            }}
        >
            {/* FlatList plutôt que ScrollView : ne rend que les lignes visibles à
            l'écran au lieu de tout le catalogue filtré d'un coup — un artiste avec
            beaucoup de titres, ou un catalogue volumineux, reste fluide en
            scrollant sans créer autant de lignes que de résultats dès le premier
            rendu. Les pochettes ne changent rien à ça : seules les lignes
            réellement affichées à l'écran montent une <Image>. */}
            <FlatList
                // hauteur explicite (pas juste celle du parent) : sur Android, une
                // FlatList sans borne de hauteur propre mesure son ScrollView interne
                // à la taille de son contenu, qui devient alors égale à la zone
                // visible et donc non scrollable, même si le parent la coupe en
                // overflow: hidden (ce qui se produisait ici)
                style={{ maxHeight: MENU_MAX_HEIGHT }}
                data={suggestions}
                keyExtractor={(track) => track.id}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
                initialNumToRender={8}
                windowSize={5}
                renderItem={({ item: track }) => (
                    <TouchableOpacity
                        onPress={() => onSelect(track.id)}
                        className="flex-row items-center justify-between p-3 border-b border-offwhite"
                    >
                        <View className="flex-row items-center flex-1 pr-2">
                            {track.image ? (
                                <Image
                                    source={{ uri: track.image }}
                                    style={{ width: 40, height: 40, borderRadius: 8 }}
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
                        </View>
                        <Check size={18} color={COLORS.blindtest} />
                    </TouchableOpacity>
                )}
                ListEmptyComponent={
                    <Text className="text-darkgray text-sm text-center p-4">
                        Aucun titre trouvé
                    </Text>
                }
            />
        </Animated.View>
    )
}
