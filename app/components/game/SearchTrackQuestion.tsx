import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Keyboard, View, Text, TextInput } from 'react-native'
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
// laisse le champ réagir instantanément à la frappe, mais ne relance la
// recherche qu'une fois la frappe stabilisée : sur un gros catalogue, refaire
// le scan complet à chaque caractère tapé lors d'une frappe rapide est ce qui
// causait les freezes sur les téléphones plus anciens
const SEARCH_DEBOUNCE_MS = 120

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

    useEffect(() => {
        const timer = setTimeout(() => setDebouncedQuery(query), SEARCH_DEBOUNCE_MS)
        return () => clearTimeout(timer)
    }, [query])

    // ouvre le clavier dès le début de la manche, pour chercher sans avoir à
    // taper une première fois sur le champ. Ce composant est remonté à
    // chaque nouvelle manche (game.screen.tsx bascule entièrement sur
    // <RoundResult> entre deux manches), donc un effet au montage suffit —
    // le court délai évite qu'un focus() appelé trop tôt (juste après le
    // montage, avant que KeyboardAvoidingView ait fini de se mettre en place)
    // ne fasse rien, un problème RN classique avec la prop autoFocus seule
    useEffect(() => {
        if (hasAnswered) return
        const timer = setTimeout(() => inputRef.current?.focus(), 150)
        return () => clearTimeout(timer)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    // le clavier doit rester utilisable tant qu'il faut trouver le titre, puis
    // se refermer dès que ce n'est plus le cas : soit ce joueur vient de
    // répondre (la manche continue pour les autres, ce composant reste monté
    // mais bascule sur la carte "Réponse envoyée" ci-dessous), soit la manche
    // se termine côté serveur sans qu'il ait répondu (le parent démonte alors
    // ce composant pour afficher le résultat, cf. game.screen.tsx) — le
    // TextInput perdant le focus dans les deux cas ne suffit pas toujours à
    // fermer le clavier logiciel tout seul, d'où le Keyboard.dismiss() explicite
    useEffect(() => {
        if (hasAnswered) Keyboard.dismiss()
    }, [hasAnswered])

    useEffect(() => () => Keyboard.dismiss(), [])

    // normalize() (dont la normalisation Unicode NFD) est l'opération la plus
    // coûteuse de la recherche : calculée ici une seule fois par catalogue
    // (au changement de manche), pas à chaque caractère tapé — avant, elle
    // tournait sur tout le catalogue à chaque frappe, ce qui devenait sensible
    // sur un gros catalogue et sur des appareils plus anciens
    const normalizedCatalog = useMemo(
        () =>
            catalog.map((track) => {
                const normalizedName = normalize(track.name)
                const normalizedArtist = normalize(track.artist)
                return {
                    track,
                    normalizedName,
                    // précalculé aussi : c'est ce que scanne la recherche combinée
                    // ci-dessous, inutile de le reconstruire à chaque frappe
                    haystack: `${normalizedName} ${normalizedArtist}`,
                }
            }),
        [catalog]
    )

    // recherche sur le titre ET l'artiste. Au-delà d'une simple sous-chaîne
    // sur un seul champ, "dj snake taki taki" ou "taki taki dj snake" (titre +
    // artiste combinés, dans n'importe quel ordre) doivent aussi retrouver le
    // titre : chaque mot de la recherche est donc cherché indépendamment dans
    // le titre + l'artiste concaténés, plutôt que d'exiger que la recherche
    // entière soit une sous-chaîne d'un seul des deux champs. Se base sur
    // debouncedQuery (pas query) : cf. SEARCH_DEBOUNCE_MS plus haut.
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

        // pas de plafond ici : la liste défile dans une FlatList virtualisée
        // (cf. plus bas, ne rend que les lignes visibles à l'écran même pour
        // une longue liste) — un titre d'artiste ou un titre partagé par
        // plusieurs versions doit rester accessible en scrollant, pas coupé
        return [...nameStartsWith, ...nameContains, ...combinedMatches]
    }, [debouncedQuery, normalizedCatalog])

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
        // zIndex élevé pour que le dropdown flotte au-dessus du reste du
        // contenu au lieu de pousser la mise en page (sinon gros vide tant
        // que rien n'est tapé). Il s'ouvre vers le haut (bottom-full) car la
        // barre de recherche est en bas de l'écran, juste au-dessus du clavier.
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

            {showDropdown && <TrackSuggestionsList suggestions={suggestions} onSelect={handleSelect} />}
        </View>
    )
}
