import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Keyboard, View, Text, TextInput, useWindowDimensions } from 'react-native'
import { Search } from 'lucide-react-native'
import { COLORS } from '../../core/constants/colors.constants'
import { TrackSuggestionsList } from './TrackSuggestionsList'
import type { CatalogEntry } from '../../core/types'

type SearchTrackQuestionProps = {
    catalog: CatalogEntry[]
    hasAnswered: boolean
    selectedId: string | null
    onAnswer: (id: string) => void
}

const MIN_QUERY_LENGTH = 2
// on relance la recherche qu'une fois que la frappe s'arrête un peu, sinon
// ça freeze sur les vieux téléphones avec un gros catalogue
const SEARCH_DEBOUNCE_MS = 120

// sur web/PWA (voir public/index.html), windowHeight reflète la hauteur
// réellement visible (déjà réduite par le clavier, cf. Dimensions de
// react-native-web qui suit window.visualViewport). On en réserve la moitié
// pour la liste de suggestions, plutôt qu'une hauteur fixe : ça en affiche
// plus quand le clavier prend moins de place (ou est fermé), et ça reste
// raisonnable sur un petit iPhone avec le clavier ouvert. La barre de
// recherche est juste sous le titre (cf. game.screen.tsx), pas plaquée en
// bas de l'écran — sinon le clavier la recouvrait complètement. La liste
// s'ouvre donc EN DESSOUS d'elle (voir TrackSuggestionsList), dans l'espace
// qui reste jusqu'au clavier
const SUGGESTIONS_MAX_HEIGHT_RATIO = 0.5
const SUGGESTIONS_MAX_HEIGHT_CAP = 420

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
    onAnswer,
}) => {
    const [query, setQuery] = useState('')
    const [debouncedQuery, setDebouncedQuery] = useState('')
    const inputRef = useRef<TextInput>(null)
    const { height: windowHeight } = useWindowDimensions()
    const suggestionsMaxHeight = Math.min(
        Math.round(windowHeight * SUGGESTIONS_MAX_HEIGHT_RATIO),
        SUGGESTIONS_MAX_HEIGHT_CAP
    )

    useEffect(() => {
        const timer = setTimeout(() => setDebouncedQuery(query), SEARCH_DEBOUNCE_MS)
        return () => clearTimeout(timer)
    }, [query])

    // ouvre le clavier direct au début de la manche. Le petit délai est là
    // parce que focus() appelé trop tôt au montage ne marche pas toujours
    useEffect(() => {
        if (hasAnswered) return
        const timer = setTimeout(() => inputRef.current?.focus(), 150)
        return () => clearTimeout(timer)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    // on ferme le clavier à la main une fois qu'on a répondu, en gros
    // perdre juste le focus du champ suffit pas toujours à le fermer
    useEffect(() => {
        if (hasAnswered) Keyboard.dismiss()
    }, [hasAnswered])

    useEffect(() => () => Keyboard.dismiss(), [])

    // normalize() coûte cher, dcp on le fait une fois par catalogue et pas
    // à chaque caractère tapé
    const normalizedCatalog = useMemo(
        () =>
            catalog.map((track) => {
                const normalizedName = normalize(track.name)
                const normalizedArtist = normalize(track.artist)
                return {
                    track,
                    normalizedName,
                    // aussi précalculé, pour pas le refaire à chaque frappe
                    haystack: `${normalizedName} ${normalizedArtist}`,
                }
            }),
        [catalog]
    )

    // recherche sur le titre ET l'artiste, mot par mot et dans n'importe quel
    // ordre — dcp "gambi loca loca" trouve le titre même écrit dans
    // l'autre sens
    const suggestions = useMemo(() => {
        const normalizedQuery = normalize(debouncedQuery)
        if (normalizedQuery.length < MIN_QUERY_LENGTH) return []

        const queryWords = normalizedQuery.split(/\s+/).filter(Boolean)

        const nameStartsWith: CatalogEntry[] = []
        const nameContains: CatalogEntry[] = []
        const combinedMatches: CatalogEntry[] = []

        for (const { track, normalizedName, haystack } of normalizedCatalog) {
            if (normalizedName.startsWith(normalizedQuery)) {
                nameStartsWith.push(track)
                continue
            }
            if (normalizedName.includes(normalizedQuery)) {
                nameContains.push(track)
                continue
            }
            if (queryWords.every((word) => haystack.includes(word))) {
                combinedMatches.push(track)
            }
        }

        // pas de limite sur le nombre de résultats, la liste en dessous est
        // virtualisée donc ça reste fluide même avec beaucoup de résultats
        return [...nameStartsWith, ...nameContains, ...combinedMatches]
    }, [debouncedQuery, normalizedCatalog])

    const selectedTrack = selectedId ? catalog.find((t) => t.id === selectedId) : null

    // référence stable, sinon TrackSuggestionsList perd le bénéfice de son
    // memo à chaque frappe
    const handleSelect = useCallback(
        (id: string) => {
            if (hasAnswered) return
            onAnswer(id)
        },
        [hasAnswered, onAnswer]
    )

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
        // zIndex élevé pour que la liste de suggestions flotte par-dessus
        // au lieu de pousser tout le contenu vers le bas
        <View style={{ zIndex: 10 }}>
            <View className="flex-row items-center bg-offwhite rounded-2xl px-4 py-3">
                <Search size={18} color={COLORS.darkgray} />
                <TextInput
                    ref={inputRef}
                    className="flex-1 ml-2 text-black text-base"
                    style={{ letterSpacing: 0 }}
                    value={query}
                    onChangeText={setQuery}
                    placeholder="Cherche un titre ou un artiste..."
                    placeholderTextColor={COLORS.darkgray}
                    autoCapitalize="none"
                    autoCorrect={false}
                />
            </View>

            {showDropdown && (
                <TrackSuggestionsList
                    suggestions={suggestions}
                    onSelect={handleSelect}
                    maxHeight={suggestionsMaxHeight}
                />
            )}
        </View>
    )
}
