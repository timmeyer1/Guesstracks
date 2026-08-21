import { io, Socket } from 'socket.io-client'
import { LOBBY_SERVER_URL } from './constants'
import type { GameRoundStart, GameRoundEnd, GameStarted, GameEnd, TrackType } from './types'

let socket: Socket | null = null

const getSocket = (): Socket => {
    if (!socket) {
        socket = io(LOBBY_SERVER_URL, {
            transports: ['websocket'],
            autoConnect: true,
        })
    }
    return socket
}

export const subscribeToLobby = (
    code: string,
    handlers: { onUpdate: (lobby: unknown) => void; onClosed: () => void }
) => {
    const s = getSocket()
    s.emit('lobby:subscribe', code)
    s.on('lobby:update', handlers.onUpdate)
    s.on('lobby:closed', handlers.onClosed)

    return () => {
        s.off('lobby:update', handlers.onUpdate)
        s.off('lobby:closed', handlers.onClosed)
        s.emit('lobby:unsubscribe', code)
    }
}

// ---- Jeu ----
// Contrairement au lobby, la partie n'a pas d'API REST : le serveur pilote le
// déroulé (timers de manche) et pousse tout par socket.

export type GameStatePayload =
    | { status: 'idle' | 'collecting' | 'finished' }
    | { status: 'in_round'; round: GameRoundStart }
    | { status: 'round_result'; roundIndex: number | null; totalRounds: number; leaderboard: unknown }

export type GameSocketHandlers = {
    onStarted: (payload: GameStarted) => void
    onRoundStart: (payload: GameRoundStart) => void
    onRoundEnd: (payload: GameRoundEnd) => void
    onEnd: (payload: GameEnd) => void
    onError: (payload: { message: string }) => void
    onState: (payload: GameStatePayload) => void
    // diffusé à chaque fois qu'un joueur envoie ses musiques likées, pour que
    // le lobby puisse afficher/bloquer "Lancer la partie" tant que tout le
    // monde n'a pas encore envoyé les siennes
    onTracksProgress: (payload: { submittedPlayerIds: string[] }) => void
    // diffusé à la fin d'une partie puis à chaque joueur qui revient au lobby
    // (ou le quitte) : liste de ceux encore attendus avant de pouvoir relancer
    onReturnProgress: (payload: { pendingPlayerIds: string[] }) => void
}

export const subscribeToGame = (handlers: GameSocketHandlers) => {
    const s = getSocket()
    s.on('game:started', handlers.onStarted)
    s.on('game:round:start', handlers.onRoundStart)
    s.on('game:round:end', handlers.onRoundEnd)
    s.on('game:end', handlers.onEnd)
    s.on('game:error', handlers.onError)
    s.on('game:state', handlers.onState)
    s.on('game:tracksProgress', handlers.onTracksProgress)
    s.on('game:returnProgress', handlers.onReturnProgress)

    return () => {
        s.off('game:started', handlers.onStarted)
        s.off('game:round:start', handlers.onRoundStart)
        s.off('game:round:end', handlers.onRoundEnd)
        s.off('game:end', handlers.onEnd)
        s.off('game:error', handlers.onError)
        s.off('game:state', handlers.onState)
        s.off('game:tracksProgress', handlers.onTracksProgress)
        s.off('game:returnProgress', handlers.onReturnProgress)
    }
}

type GamePlayerPayload = { id: string; name: string; img: string | null; accountType: string | null }

export const emitSubmitTracks = (code: string, player: GamePlayerPayload, tracks: TrackType[]) => {
    getSocket().emit('game:submitTracks', { code, player, tracks })
}

export const emitStartGame = (code: string, playerId: string) => {
    getSocket().emit('game:start', { code, playerId })
}

export const emitAnswer = (code: string, playerId: string, roundIndex: number, selected: string[]) => {
    getSocket().emit('game:answer', { code, playerId, roundIndex, selected })
}

export const emitGameSync = (code: string) => {
    getSocket().emit('game:sync', code)
}

export const emitConfirmReturn = (code: string, playerId: string) => {
    getSocket().emit('game:confirmReturn', { code, playerId })
}
