import { registerGameSockets } from './game.sockets.js'
import { verifyLobbyToken, LobbyTokenError } from '../utils/lobbyToken.js'

// Le socket ne fait que diffuser l'état du lobby en temps réel : toutes les
// mutations passent par l'API REST (source de vérité), ce qui évite de traiter
// les déconnexions réseau (fréquentes sur mobile) comme des départs de joueur.
//
// lobby:subscribe exige le jeton de lobby signé à la création/l'entrée dans
// le lobby (cf. lobby.routes.js) : une fois vérifié, l'identité du joueur est
// fixée sur ce socket (socket.data.playerId/lobbyCode) et sert de seule source
// de vérité pour game.sockets.js — jamais un playerId fourni dans un payload,
// falsifiable par n'importe quel client (cf. audit sécurité, finding C1).
export const registerLobbySockets = (io) => {
    io.on('connection', (socket) => {
        socket.on('lobby:subscribe', (payload) => {
            const code = typeof payload === 'string' ? payload : payload?.code
            const token = typeof payload === 'string' ? undefined : payload?.token
            if (typeof code !== 'string' || !code) return
            const upperCode = code.toUpperCase()

            try {
                const identity = verifyLobbyToken(token, upperCode)
                socket.data.playerId = identity.playerId
                socket.data.lobbyCode = upperCode
            } catch (err) {
                socket.emit('lobby:error', {
                    message: err instanceof LobbyTokenError ? err.message : 'Session de lobby invalide',
                })
                return
            }

            socket.join(`lobby:${upperCode}`)
        })

        socket.on('lobby:unsubscribe', (code) => {
            if (typeof code !== 'string' || !code) return
            const upperCode = code.toUpperCase()
            socket.leave(`lobby:${upperCode}`)
            if (socket.data.lobbyCode === upperCode) {
                socket.data.playerId = undefined
                socket.data.lobbyCode = undefined
            }
        })
    })

    registerGameSockets(io)
}
