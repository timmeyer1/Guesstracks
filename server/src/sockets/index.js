import { registerGameSockets } from './game.sockets.js'

// Le socket ne fait que diffuser l'état du lobby en temps réel : toutes les
// mutations passent par l'API REST (source de vérité), ce qui évite de traiter
// les déconnexions réseau (fréquentes sur mobile) comme des départs de joueur.
export const registerLobbySockets = (io) => {
    io.on('connection', (socket) => {
        socket.on('lobby:subscribe', (code) => {
            if (typeof code !== 'string' || !code) return
            socket.join(`lobby:${code.toUpperCase()}`)
        })

        socket.on('lobby:unsubscribe', (code) => {
            if (typeof code !== 'string' || !code) return
            socket.leave(`lobby:${code.toUpperCase()}`)
        })
    })

    registerGameSockets(io)
}
