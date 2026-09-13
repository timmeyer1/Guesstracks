import { registerGameSockets } from './game.sockets.js'
import { verifyLobbyToken, LobbyTokenError } from '../utils/lobbyToken.js'

// le socket sert juste à diffuser l'état du lobby en temps réel, toutes les
// vraies actions passent par l'API REST. en gros ça évite de traiter une
// coupure réseau (fréquente sur mobile) comme un départ de joueur.
//
// lobby:subscribe demande le jeton signé créé à l'entrée dans le lobby (voir
// lobby.routes.js). une fois vérifié, l'identité du joueur reste collée à ce
// socket et c'est la seule source fiable pour game.sockets.js, jamais un
// playerId envoyé dans le payload, n'importe qui pourrait le trafiquer.
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
