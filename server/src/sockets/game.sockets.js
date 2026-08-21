import * as gameService from '../services/game.service.js'
import * as lobbyService from '../services/lobby.service.js'

const isValidCode = (code) => typeof code === 'string' && code.trim().length > 0

const errorMessage = (err) => (err instanceof Error ? err.message : 'Erreur inconnue')

// La partie est pilotée par socket (timers serveur), à la différence du lobby
// dont l'API REST reste la source de vérité (cf. sockets/index.js) : ici
// l'état est par nature éphémère et rythmé par le serveur, un aller-retour
// REST n'apporterait rien.
export const registerGameSockets = (io) => {
    io.on('connection', (socket) => {
        socket.on('game:submitTracks', (payload = {}) => {
            const { code, player, tracks } = payload
            if (!isValidCode(code)) return
            try {
                gameService.submitTracks(code.toUpperCase(), player, tracks, io)
            } catch (err) {
                socket.emit('game:error', { message: errorMessage(err) })
            }
        })

        socket.on('game:start', async (payload = {}) => {
            const { code, playerId } = payload
            if (!isValidCode(code) || typeof playerId !== 'string') return
            const upperCode = code.toUpperCase()

            try {
                const lobby = await lobbyService.getLobby(upperCode)
                await gameService.startGame({ code: upperCode, playerId, lobby: lobby.toPublic(), io })
            } catch (err) {
                socket.emit('game:error', { message: errorMessage(err) })
            }
        })

        socket.on('game:answer', (payload = {}) => {
            const { code, playerId, roundIndex, selected } = payload
            if (!isValidCode(code) || typeof playerId !== 'string' || typeof roundIndex !== 'number') return
            gameService.submitAnswer({ code: code.toUpperCase(), playerId, roundIndex, selected, io })
        })

        // permet à un client qui vient de (re)rejoindre la room de resynchroniser
        // son affichage sur l'état de partie en cours (reconnexion réseau, etc.)
        socket.on('game:sync', (code) => {
            if (!isValidCode(code)) return
            socket.emit('game:state', gameService.getSnapshot(code.toUpperCase()))
        })

        // envoyé quand l'écran de lobby regagne le focus (retour depuis les
        // résultats finaux, ou simple arrivée dans le lobby) : sort le joueur
        // de la liste d'attente ouverte par la fin d'une partie précédente
        socket.on('game:confirmReturn', (payload = {}) => {
            const { code, playerId } = payload
            if (!isValidCode(code) || typeof playerId !== 'string') return
            gameService.clearPendingReturn(code.toUpperCase(), playerId, io)
        })
    })
}
