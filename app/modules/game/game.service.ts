import { useAuthStore } from '../../stores/auth.store'
import { useLobbyStore } from '../../stores/lobby.store'
import { useGameStore } from '../../stores/game.store'
import { TrackStore } from '../../stores/tracks.store'
import {
    subscribeToGame,
    emitSubmitTracks,
    emitStartGame,
    emitAnswer,
    emitGameSync,
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
            store.setLeaderboard(payload.leaderboard as any)
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

// écoute les événements de jeu pour toute la durée du lobby : à appeler dès
// l'entrée dans l'écran de lobby, avant même que la partie démarre, pour ne
// rater ni "game:started" ni le premier "game:round:start"
export const startWatchingGame = () => {
    stopWatchingGame()

    unsubscribeGame = subscribeToGame({
        onStarted: (payload: GameStarted) => {
            // état transitoire : le pool est prêt, le premier "round:start" arrive
            // dans la foulée
            useGameStore.getState().setPhase('collecting')
            useGameStore.getState().setGameMode(payload.gameMode)
            useGameStore.getState().setTotalRounds(payload.totalRounds)
        },
        onRoundStart: (payload: GameRoundStart) => {
            useGameStore.getState().startRound(payload)
        },
        onRoundEnd: (payload: GameRoundEnd) => {
            useGameStore.getState().endRound(payload)
        },
        onEnd: (payload: GameEnd) => {
            useGameStore.getState().setFinal(payload.leaderboard, payload.totalRounds)
        },
        onError: (payload) => {
            useGameStore.getState().setError(payload.message)
        },
        onState: applySnapshot,
    })
}

export const stopWatchingGame = () => {
    unsubscribeGame?.()
    unsubscribeGame = null
}

// à appeler en quittant le lobby (la partie ne doit pas survivre après ça)
export const leaveGame = () => {
    stopWatchingGame()
    useGameStore.getState().reset()
}

// envoie ses titres likés au serveur dès l'entrée dans le lobby, pour que le
// pool soit prêt quand l'hôte lance la partie
export const submitMyTracks = () => {
    const { lobby } = useLobbyStore.getState()
    const player = buildPlayerPayload()
    const tracks = TrackStore.getState().likedTracks

    if (!lobby || !player || tracks.length === 0) return
    emitSubmitTracks(lobby.code, player, tracks)
}

export const startGame = () => {
    const { lobby } = useLobbyStore.getState()
    const { user } = useAuthStore.getState()
    if (!lobby || !user) return
    emitStartGame(lobby.code, user.id)
}

export const submitAnswer = (selected: string[]) => {
    const { lobby } = useLobbyStore.getState()
    const { user } = useAuthStore.getState()
    const { round, hasAnswered } = useGameStore.getState()
    if (!lobby || !user || !round || hasAnswered) return

    useGameStore.getState().setHasAnswered(true)
    emitAnswer(lobby.code, user.id, round.roundIndex, selected)
}

// à appeler après une reconnexion pour rattraper l'état de partie en cours
export const syncGame = () => {
    const { lobby } = useLobbyStore.getState()
    if (!lobby) return
    emitGameSync(lobby.code)
}
