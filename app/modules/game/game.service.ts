import { useAuthStore } from '../../stores/auth.store'
import { useLobbyStore } from '../../stores/lobby.store'
import { useGameStore } from '../../stores/game.store'
import { useTrackStore } from '../../stores/tracks.store'
import {
    subscribeToGame,
    emitSubmitTracks,
    emitStartGame,
    emitAnswer,
    emitGameSync,
    emitConfirmReturn,
    emitNextRound,
    emitReportWrongPreview,
    type GameStatePayload,
} from '../../core/socket'
import type { GameRoundStart, GameRoundEnd, GameEnd, GameStarted } from '../../core/types'

let unsubscribeGame: (() => void) | null = null

const buildPlayerPayload = () => {
    const { user } = useAuthStore.getState()
    if (!user) return null
    return {
        id: user.id,
        name: user.display_name,
        img: user.img || null,
        accountType: user.account_type || null,
    }
}

const applySnapshot = (payload: GameStatePayload) => {
    const store = useGameStore.getState()

    switch (payload.status) {
        case 'in_round':
            store.startRound(payload.round)
            break
        case 'round_result':
            store.setPhase('round_result')
            store.setTotalRounds(payload.totalRounds)
            store.setLeaderboard(payload.leaderboard)
            break
        case 'finished':
            store.setPhase('finished')
            break
        case 'collecting':
            store.setPhase('collecting')
            break
        default:
            break
    }
}

// écoute les events de jeu pendant tout le lobby. À lancer dès l'arrivée
// dans le lobby (avant même que la partie démarre) pour rien louper
export const startWatchingGame = () => {
    stopWatchingGame()

    unsubscribeGame = subscribeToGame({
        onStarted: (payload: GameStarted) => {
            // état de transition, le premier round arrive juste après
            useGameStore.getState().setPhase('collecting')
            useGameStore.getState().setGameMode(payload.gameMode)
            useGameStore.getState().setManualAdvance(payload.manualAdvance)
            useGameStore.getState().setTotalRounds(payload.totalRounds)
            useGameStore.getState().setCatalog(payload.catalog ?? [])
        },
        onRoundStart: (payload: GameRoundStart) => {
            useGameStore.getState().startRound(payload)
        },
        onRoundEnd: (payload: GameRoundEnd) => {
            useGameStore.getState().endRound(payload)
        },
        onEnd: (payload: GameEnd) => {
            useGameStore.getState().setFinal(payload.leaderboard, payload.totalRounds, payload.audioStartedAt)
        },
        onError: (payload) => {
            useGameStore.getState().setError(payload.message)
        },
        onState: applySnapshot,
        onTracksProgress: (payload) => {
            useGameStore.getState().setSubmittedPlayerIds(payload.submittedPlayerIds)
        },
        onCatalogEnriched: (payload) => {
            useGameStore.getState().enrichCatalog(payload.updates)
        },
        onReturnProgress: (payload) => {
            useGameStore.getState().setPendingReturnPlayerIds(payload.pendingPlayerIds)
        },
    })
}

export const stopWatchingGame = () => {
    unsubscribeGame?.()
    unsubscribeGame = null
}

// à appeler en quittant le lobby, la partie doit pas survivre après ça
export const leaveGame = () => {
    stopWatchingGame()
    useGameStore.getState().reset()
}

const SUBMIT_TRACKS_RETRY_MS = 1500
const SUBMIT_TRACKS_MAX_ATTEMPTS = 4

// envoie ses titres likés dès l'arrivée dans le lobby, pour que ce soit prêt
// quand l'hôte lance la partie. Si les titres sont pas encore chargés dcp on
// réessaie plusieurs fois — sinon l'hôte restait bloqué sur "en attente" indéfiniment
export const submitMyTracks = (attempt = 1) => {
    const { lobby } = useLobbyStore.getState()
    const player = buildPlayerPayload()
    const tracks = useTrackStore.getState().likedTracks

    if (!lobby || !player) return

    if (tracks.length === 0) {
        if (attempt >= SUBMIT_TRACKS_MAX_ATTEMPTS) {
            console.warn('⚠️ Aucun titre liké disponible après plusieurs tentatives, envoi abandonné')
            return
        }
        setTimeout(() => submitMyTracks(attempt + 1), SUBMIT_TRACKS_RETRY_MS)
        return
    }

    emitSubmitTracks(lobby.code, player, tracks)
}

export const startGame = () => {
    const { lobby } = useLobbyStore.getState()
    const { user } = useAuthStore.getState()
    if (!lobby || !user) return
    emitStartGame(lobby.code)
}

export const submitAnswer = (selected: string[]) => {
    const { lobby } = useLobbyStore.getState()
    const { user } = useAuthStore.getState()
    const { round, hasAnswered } = useGameStore.getState()
    if (!lobby || !user || !round || hasAnswered) return

    useGameStore.getState().setHasAnswered(true)
    emitAnswer(lobby.code, round.roundIndex, selected)
}

// marche que si "avancer manuellement" est activé et que c'est l'hôte qui
// appelle — le serveur revérifie les deux de son côté de toute façon
export const advanceRound = () => {
    const { lobby } = useLobbyStore.getState()
    if (!lobby) return
    emitNextRound(lobby.code)
}

// bouton "Pas le bon extrait ?" de l'écran de résultat. Ça change rien à la
// manche en cours, ça sert juste à nourrir la base de corrections côté serveur
export const reportWrongPreview = (roundIndex: number) => {
    const { lobby } = useLobbyStore.getState()
    if (!lobby) return
    emitReportWrongPreview(lobby.code, roundIndex)
}

// à appeler après une reconnexion pour rattraper l'état de partie en cours
export const syncGame = () => {
    const { lobby } = useLobbyStore.getState()
    if (!lobby) return
    emitGameSync(lobby.code)
}

// à appeler chaque fois que l'écran de lobby reprend le focus : dit au
// serveur que ce joueur est bien revenu, ce qui débloque "Lancer la partie"
// côté hôte une fois que tout le monde est revenu
export const confirmReturnedToLobby = () => {
    const { lobby } = useLobbyStore.getState()
    const { user } = useAuthStore.getState()
    if (!lobby || !user) return
    emitConfirmReturn(lobby.code)
}
