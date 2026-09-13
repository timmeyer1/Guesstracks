import { io, Socket } from 'socket.io-client'
import { LOBBY_SERVER_URL } from './constants'
import type { GameRoundStart, GameRoundEnd, GameStarted, GameEnd, LeaderboardEntry, TrackType } from './types'

let socket: Socket | null = null

const getSocket = (): Socket => {
    if (!socket) {
        socket = io(LOBBY_SERVER_URL, {
            transports: ['websocket'],
            autoConnect: true,
            // Même raison que dans lobby.client.ts : sinon ngrok bloque avec son avertissement de tunnel gratuit.
            extraHeaders: { 'ngrok-skip-browser-warning': 'true' },
        })
        // Le serveur envoie ça si le jeton du lobby manque, est invalide ou expiré.
        // Dcp le socket reste sans identité et toutes les actions suivantes sont ignorées en silence côté serveur.
        socket.on('lobby:error', (payload: { message: string }) => {
            console.warn('⚠️ Session de lobby invalide :', payload.message)
        })
    }
    return socket
}

// token : le jeton de session, vérifié côté serveur avant de rattacher le
// socket au lobby. C'est lui qui identifie le joueur ensuite, jamais un playerId brut.
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
// En gros, contrairement au lobby, la partie n'a pas d'API REST : le serveur gère tout et pousse les infos par socket.

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
    // Envoyé à chaque validation de musiques par un joueur, pour savoir qui bloque encore le bouton "Lancer la partie".
    onTracksProgress: (payload: { submittedPlayerIds: string[] }) => void
    // En fin de partie, dit qui manque encore avant de pouvoir relancer une manche.
    onReturnProgress: (payload: { pendingPlayerIds: string[] }) => void
    // Envoyé après game:started en blindtest (parfois plusieurs fois) pour
    // ajouter les featurings trouvés côté serveur. À fusionner par id, pas à remplacer.
    onCatalogEnriched: (payload: { updates: { id: string; artist: string }[] }) => void
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
    s.on('game:catalogEnriched', handlers.onCatalogEnriched)

    return () => {
        s.off('game:started', handlers.onStarted)
        s.off('game:round:start', handlers.onRoundStart)
        s.off('game:round:end', handlers.onRoundEnd)
        s.off('game:end', handlers.onEnd)
        s.off('game:error', handlers.onError)
        s.off('game:state', handlers.onState)
        s.off('game:tracksProgress', handlers.onTracksProgress)
        s.off('game:returnProgress', handlers.onReturnProgress)
        s.off('game:catalogEnriched', handlers.onCatalogEnriched)
    }
}

type GamePlayerPayload = { id: string; name: string; img: string | null; accountType: string | null }

// Aucune de ces fonctions n'envoie de playerId : le serveur connaît déjà le joueur via lobby:subscribe.
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

// Ne fait rien si le lobby n'a pas activé "avancer manuellement", le serveur enchaîne déjà tout seul sinon.
export const emitNextRound = (code: string) => {
    getSocket().emit('game:nextRound', { code })
}

// Bouton "Pas le bon extrait ?" : pas besoin d'envoyer titre/artiste, le serveur retrouve la manche avec roundIndex.
export const emitReportWrongPreview = (code: string, roundIndex: number) => {
    getSocket().emit('game:reportWrongPreview', { code, roundIndex })
}
