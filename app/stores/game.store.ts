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
    totalRounds: number
    round: GameRoundStart | null
    lastRoundEnd: GameRoundEnd | null
    leaderboard: LeaderboardEntry[]
    finalLeaderboard: FinalLeaderboardEntry[]
    catalog: CatalogEntry[] // titres cherchables en mode blindtest
    mySelection: string[]
    hasAnswered: boolean
    error: string | null

    setPhase: (phase: GamePhase) => void
    setGameMode: (gameMode: GameMode) => void
    setTotalRounds: (totalRounds: number) => void
    setCatalog: (catalog: CatalogEntry[]) => void
    startRound: (round: GameRoundStart) => void
    endRound: (payload: GameRoundEnd) => void
    setLeaderboard: (leaderboard: LeaderboardEntry[]) => void
    setFinal: (leaderboard: FinalLeaderboardEntry[], totalRounds: number) => void
    toggleSelection: (id: string, multi: boolean) => void
    setHasAnswered: (hasAnswered: boolean) => void
    setError: (message: string | null) => void
    reset: () => void
}

const initialState = {
    phase: 'idle' as GamePhase,
    gameMode: null as GameMode | null,
    totalRounds: 0,
    round: null as GameRoundStart | null,
    lastRoundEnd: null as GameRoundEnd | null,
    leaderboard: [] as LeaderboardEntry[],
    finalLeaderboard: [] as FinalLeaderboardEntry[],
    catalog: [] as CatalogEntry[],
    mySelection: [] as string[],
    hasAnswered: false,
    error: null as string | null,
}

export const useGameStore = create<GameStoreType>((set, get) => ({
    ...initialState,

    setPhase: (phase) => set({ phase }),
    setGameMode: (gameMode) => set({ gameMode }),
    setTotalRounds: (totalRounds) => set({ totalRounds }),
    setCatalog: (catalog) => set({ catalog }),

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

    setFinal: (finalLeaderboard, totalRounds) =>
        set({ phase: 'finished', finalLeaderboard, totalRounds }),

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

    reset: () => set({ ...initialState }),
}))
