import { create } from 'zustand'
import type {
    GamePhase,
    GameMode,
    GameRoundStart,
    GameRoundEnd,
    LeaderboardEntry,
    FinalLeaderboardEntry,
    CatalogEntry,
} from '../core/types'

type GameStoreType = {
    phase: GamePhase
    gameMode: GameMode | null
    // figé au lancement de la partie : dit si RoundResult affiche un bouton
    // "manche suivante" pour l'hôte, ou passe tout seul à la suite
    manualAdvance: boolean
    totalRounds: number
    round: GameRoundStart | null
    lastRoundEnd: GameRoundEnd | null
    leaderboard: LeaderboardEntry[]
    finalLeaderboard: FinalLeaderboardEntry[]
    // en gros l'instant commun où rejouer l'extrait sur l'écran de résultats finaux
    finalAudioStartedAt: number | null
    catalog: CatalogEntry[] // titres cherchables en mode blindtest
    mySelection: string[]
    hasAnswered: boolean
    error: string | null
    // joueurs qui ont déjà envoyé leurs musiques likées, bloque "Lancer la partie" sinon
    submittedPlayerIds: string[]
    // joueurs de la partie qui vient de finir, encore attendus au lobby avant de relancer
    pendingReturnPlayerIds: string[]

    setPhase: (phase: GamePhase) => void
    setGameMode: (gameMode: GameMode) => void
    setManualAdvance: (manualAdvance: boolean) => void
    setTotalRounds: (totalRounds: number) => void
    setCatalog: (catalog: CatalogEntry[]) => void
    // ajoute les featurings reçus après coup, juste pour améliorer la recherche
    enrichCatalog: (updates: { id: string; artist: string }[]) => void
    setSubmittedPlayerIds: (ids: string[]) => void
    setPendingReturnPlayerIds: (ids: string[]) => void
    startRound: (round: GameRoundStart) => void
    endRound: (payload: GameRoundEnd) => void
    setLeaderboard: (leaderboard: LeaderboardEntry[]) => void
    setFinal: (leaderboard: FinalLeaderboardEntry[], totalRounds: number, audioStartedAt: number) => void
    toggleSelection: (id: string, multi: boolean) => void
    setHasAnswered: (hasAnswered: boolean) => void
    setError: (message: string | null) => void
    // reset complet, en entrant ou sortant d'un lobby : remet tout à zéro
    // dcp on hérite jamais d'un résidu du lobby précédent
    reset: () => void
    // reset partiel pour "Rester dans le lobby" après une partie, en gros
    // garde submittedPlayerIds/pendingReturnPlayerIds le temps de relancer
    resetForRematch: () => void
}

const initialState = {
    phase: 'idle' as GamePhase,
    gameMode: null as GameMode | null,
    manualAdvance: false,
    totalRounds: 0,
    round: null as GameRoundStart | null,
    lastRoundEnd: null as GameRoundEnd | null,
    leaderboard: [] as LeaderboardEntry[],
    finalLeaderboard: [] as FinalLeaderboardEntry[],
    finalAudioStartedAt: null as number | null,
    catalog: [] as CatalogEntry[],
    mySelection: [] as string[],
    hasAnswered: false,
    error: null as string | null,
    submittedPlayerIds: [] as string[],
    pendingReturnPlayerIds: [] as string[],
}

// sous-ensemble d'initialState pour resetForRematch, garde les deux ids d'attente
const rematchState = {
    phase: initialState.phase,
    gameMode: initialState.gameMode,
    manualAdvance: initialState.manualAdvance,
    totalRounds: initialState.totalRounds,
    round: initialState.round,
    lastRoundEnd: initialState.lastRoundEnd,
    leaderboard: initialState.leaderboard,
    finalLeaderboard: initialState.finalLeaderboard,
    finalAudioStartedAt: initialState.finalAudioStartedAt,
    catalog: initialState.catalog,
    mySelection: initialState.mySelection,
    hasAnswered: initialState.hasAnswered,
    error: initialState.error,
}

export const useGameStore = create<GameStoreType>((set, get) => ({
    ...initialState,

    setPhase: (phase) => set({ phase }),
    setGameMode: (gameMode) => set({ gameMode }),
    setManualAdvance: (manualAdvance) => set({ manualAdvance }),
    setTotalRounds: (totalRounds) => set({ totalRounds }),
    setCatalog: (catalog) => set({ catalog }),
    enrichCatalog: (updates) => {
        const byId = new Map(updates.map((u) => [u.id, u.artist]))
        set({ catalog: get().catalog.map((entry) => (byId.has(entry.id) ? { ...entry, artist: byId.get(entry.id)! } : entry)) })
    },
    setSubmittedPlayerIds: (submittedPlayerIds) => set({ submittedPlayerIds }),
    setPendingReturnPlayerIds: (pendingReturnPlayerIds) => set({ pendingReturnPlayerIds }),

    startRound: (round) =>
        set({
            phase: 'in_round',
            round,
            totalRounds: round.totalRounds,
            mySelection: [],
            hasAnswered: false,
            lastRoundEnd: null,
        }),

    endRound: (payload) =>
        set({
            phase: 'round_result',
            lastRoundEnd: payload,
            leaderboard: payload.leaderboard,
        }),

    setLeaderboard: (leaderboard) => set({ leaderboard }),

    setFinal: (finalLeaderboard, totalRounds, audioStartedAt) =>
        set({ phase: 'finished', finalLeaderboard, totalRounds, finalAudioStartedAt: audioStartedAt }),

    toggleSelection: (id, multi) => {
        const { mySelection } = get()
        if (!multi) {
            set({ mySelection: [id] })
            return
        }
        const alreadySelected = mySelection.includes(id)
        set({
            mySelection: alreadySelected
                ? mySelection.filter((selectedId) => selectedId !== id)
                : [...mySelection, id],
        })
    },

    setHasAnswered: (hasAnswered) => set({ hasAnswered }),
    setError: (error) => set({ error }),

    // set() garde les clés absentes de l'objet passé, dcp fallait bien mettre
    // submittedPlayerIds/pendingReturnPlayerIds dans initialState pour les
    // vider ici — sinon c'était le bug du message fantôme "en attente de 3 joueurs".
    reset: () => set({ ...initialState }),
    resetForRematch: () => set(rematchState),
}))
