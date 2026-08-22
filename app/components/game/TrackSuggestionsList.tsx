import React, { useCallback, useEffect } from 'react'
import { View, Text } from 'react-native'
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated'
import { Image } from 'expo-image'
import { cssInterop } from 'nativewind'
// FlatList/TouchableOpacity de gesture-handler (pas de react-native) : moteur
// de geste différent du ScrollView natif, qui négocie mieux la prise du
// scroll face aux ancêtres qui interceptent le toucher sur Android (cause du
// menu non scrollable sur certains appareils comme les Xiaomi/MIUI, malgré
// nestedScrollEnabled sur la FlatList native)
import { FlatList, TouchableOpacity } from 'react-native-gesture-handler'
import { Music } from 'lucide-react-native'
import { COLORS } from '../../core/constants/colors.constants'
import type { CatalogEntry } from '../../core/types'

// NativeWind ne convertit className -> style que pour les composants
// react-native qu'il enregistre lui-même (View, TouchableOpacity de
// react-native, etc.) : le TouchableOpacity de react-native-gesture-handler
// n'en fait pas partie, donc className y était silencieusement ignoré sans
// ça (flex-row, padding, bordure... tous absents malgré la classe posée)
cssInterop(TouchableOpacity, { className: 'style' })

type TrackSuggestionsListProps = {
    suggestions: CatalogEntry[]
    onSelect: (id: string) => void
}

const MENU_MAX_HEIGHT = 288
const OPEN_ANIMATION_MS = 180

// Ligne mémoïsée : ne re-rend que si son propre `track` change (référence
// stable tant que `suggestions` ne change pas, cf. useMemo dans
// SearchTrackQuestion.tsx) ou si `onSelect` change — d'où le useCallback côté
// appelant (cf. audit qualité, finding N4).
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

// Menu de suggestions du blindtest : remonté à chaque fois que la recherche
// redevient assez longue (cf. SearchTrackQuestion), donc un simple fondu au
// montage suffit à donner l'impression d'un menu qui s'ouvre plutôt que d'un
// bloc qui apparaît d'un coup. Pas de glissement (transform) en plus du
// fondu : combiné à un ancêtre en overflow: hidden, un transform sur un
// ancêtre d'une FlatList est un bug Android connu qui la rend non
// scrollable — exactement le problème rencontré ici.
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
        // L'ombre (shadow-card / elevation) et le overflow-hidden qui rogne la
        // FlatList doivent être sur deux Views distinctes : sur les deux
        // plateformes, une ombre posée sur une View qui clippe aussi son propre
        // calque (overflow: hidden) ne s'affiche pas. Sur Android, elevation en
        // plus fait passer la View sur son propre calque composité — combiné à
        // overflow: hidden sur cette même View, c'est ce qui rendait la liste
        // non scrollable malgré les tentatives précédentes (removeClippedSubviews,
        // suppression du transform).
        <Animated.View
            className="absolute left-0 right-0 bottom-full mb-2 rounded-2xl shadow-card"
            style={[{ maxHeight: MENU_MAX_HEIGHT, elevation: 6 }, animatedStyle]}
        >
            <View className="bg-white rounded-2xl overflow-hidden" style={{ maxHeight: MENU_MAX_HEIGHT }}>
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
                    // overflow: hidden
                    style={{ maxHeight: MENU_MAX_HEIGHT }}
                    // removeClippedSubviews (activé par défaut sur Android) mesure mal
                    // les lignes d'une FlatList logée dans un conteneur positionné en
                    // absolute + overflow: hidden comme ici, ce qui la rendait non
                    // scrollable sur Android (bug connu de React Native)
                    removeClippedSubviews={false}
                    // Android uniquement : sans ça, le conteneur natif de l'écran
                    // (react-native-screens) peut intercepter le geste de glissement
                    // vertical avant que la FlatList n'ait la chance de le récupérer,
                    // même sans ScrollView parent visible côté JS — la liste reste
                    // affichée mais ne réagit à aucun glissement (rien à voir avec le
                    // rendu, donc invisible en lisant juste le JSX)
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
