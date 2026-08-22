import { io, Socket } from 'socket.io-client'
import { LOBBY_SERVER_URL } from './constants'
import type { GameRoundStart, GameRoundEnd, GameStarted, GameEnd, LeaderboardEntry, TrackType } from './types'

let socket: Socket | null = null

const getSocket = (): Socket => {
    if (!socket) {
        socket = io(LOBBY_SERVER_URL, {
            transports: ['websocket'],
            autoConnect: true,
        })
        // émis par le serveur si lobby:subscribe reçoit un jeton de lobby
        // absent/invalide/expiré (cf. server/src/sockets/index.js) : le socket
        // n'est alors rattaché à aucune identité, toutes les actions de partie
        // suivantes sont silencieusement ignorées côté serveur
        socket.on('lobby:error', (payload: { message: string }) => {
            console.warn('⚠️ Session de lobby invalide :', payload.message)
        })
    }
    return socket
}

// token : jeton de session de lobby (cf. app/stores/lobby.store.ts), vérifié
// côté serveur avant de rattacher ce socket au lobby — c'est cette identité
// vérifiée, jamais un playerId envoyé en clair, que game.sockets.js utilise
// ensuite pour toutes les actions de partie (cf. server/src/sockets/index.js)
export const subscribeToLobby = (
    code: string,
    token: string,
    handlers: { onUpdate: (lobby: unknown) => void; onClosed: () => void }
) => {
    const s = getSocket()
    s.emit('lobby:subscribe', { code, token })
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
    | { status: 'round_result'; roundIndex: number | null; totalRounds: number; leaderboard: LeaderboardEntry[] }

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

// aucune de ces fonctions n'envoie plus de playerId : le serveur dérive
// désormais l'identité du joueur de socket.data, fixé par lobby:subscribe
// après vérification du jeton (cf. server/src/sockets/game.sockets.js) — un
// playerId dans le payload serait de toute façon ignoré côté serveur.
export const emitSubmitTracks = (code: string, player: GamePlayerPayload, tracks: TrackType[]) => {
    getSocket().emit('game:submitTracks', { code, player, tracks })
}

export const emitStartGame = (code: string) => {
    getSocket().emit('game:start', { code })
}

export const emitAnswer = (code: string, roundIndex: number, selected: string[]) => {
    getSocket().emit('game:answer', { code, roundIndex, selected })
}

export const emitGameSync = (code: string) => {
    getSocket().emit('game:sync', code)
}

export const emitConfirmReturn = (code: string) => {
    getSocket().emit('game:confirmReturn', { code })
}
