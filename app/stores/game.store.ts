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
    // ids des joueurs ayant déjà envoyé leurs musiques likées pour la partie
    // en préparation (cf. lobby.screen.tsx, bloque "Lancer la partie" tant
    // que ce n'est pas le cas pour tout le monde)
    submittedPlayerIds: string[]
    // ids des joueurs de la partie qui vient de se terminer, encore attendus
    // au lobby (revenus ou partis) avant de pouvoir relancer
    pendingReturnPlayerIds: string[]

    setPhase: (phase: GamePhase) => void
    setGameMode: (gameMode: GameMode) => void
    setTotalRounds: (totalRounds: number) => void
    setCatalog: (catalog: CatalogEntry[]) => void
    setSubmittedPlayerIds: (ids: string[]) => void
    setPendingReturnPlayerIds: (ids: string[]) => void
    startRound: (round: GameRoundStart) => void
    endRound: (payload: GameRoundEnd) => void
    setLeaderboard: (leaderboard: LeaderboardEntry[]) => void
    setFinal: (leaderboard: FinalLeaderboardEntry[], totalRounds: number) => void
    toggleSelection: (id: string, multi: boolean) => void
    setHasAnswered: (hasAnswered: boolean) => void
    setError: (message: string | null) => void
    // reset complet : à utiliser en ENTRANT ou en SORTANT d'un lobby (nouveau
    // lobby, départ volontaire, expulsion, lobby fermé par le serveur) —
    // remet TOUT l'état à zéro d'un coup (y compris submittedPlayerIds/
    // pendingReturnPlayerIds, tous deux dans initialState), pour ne jamais
    // hériter d'un résidu d'un lobby précédent.
    reset: () => void
    // reset partiel : à utiliser uniquement pour "Rester dans le lobby" APRÈS
    // une partie DANS LE MÊME lobby (cf. handleStayInLobby) — remplace tout
    // sauf submittedPlayerIds/pendingReturnPlayerIds, qui doivent survivre le
    // temps que le serveur confirme le retour de chacun avant de relancer
    resetForRematch: () => void
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
    submittedPlayerIds: [] as string[],
    pendingReturnPlayerIds: [] as string[],
}

// sous-ensemble d'initialState pour resetForRematch (préserve
// submittedPlayerIds/pendingReturnPlayerIds, cf. son commentaire ci-dessus)
const rematchState = {
    phase: initialState.phase,
    gameMode: initialState.gameMode,
    totalRounds: initialState.totalRounds,
    round: initialState.round,
    lastRoundEnd: initialState.lastRoundEnd,
    leaderboard: initialState.leaderboard,
    finalLeaderboard: initialState.finalLeaderboard,
    catalog: initialState.catalog,
    mySelection: initialState.mySelection,
    hasAnswered: initialState.hasAnswered,
    error: initialState.error,
}

export const useGameStore = create<GameStoreType>((set, get) => ({
    ...initialState,

    setPhase: (phase) => set({ phase }),
    setGameMode: (gameMode) => set({ gameMode }),
    setTotalRounds: (totalRounds) => set({ totalRounds }),
    setCatalog: (catalog) => set({ catalog }),
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

    // set() fusionne avec l'état courant : ça ne pose problème que pour les
    // clés ABSENTES de l'objet passé (qui restent alors inchangées). Contrai-
    // rement à l'ancienne version, submittedPlayerIds/pendingReturnPlayerIds
    // font maintenant partie d'initialState (cf. plus haut) et sont donc bien
    // explicitement écrasés à [] ici — c'était l'oubli qui causait le message
    // fantôme "En attente que 3 joueurs...".
    reset: () => set({ ...initialState }),
    resetForRematch: () => set(rematchState),
}))
