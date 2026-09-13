import * as gameService from '../services/game.service.js'
import * as lobbyService from '../services/lobby.service.js'

const isValidCode = (code) => typeof code === 'string' && code.trim().length > 0

const errorMessage = (err) => (err instanceof Error ? err.message : 'Erreur inconnue')

// dcp la partie est pilotée en socket (timers serveur), pas comme le lobby
// qui passe par du REST (voir sockets/index.js). ici l'état change tout seul
// au fil du temps, un aller-retour REST servirait à rien.
export const registerGameSockets = (io) => {
    io.on('connection', (socket) => {
        // l'identité vient jamais du payload (n'importe qui peut le trafiquer),
        // mais de socket.data, posé par lobby:subscribe une fois le jeton
        // vérifié (voir sockets/index.js). renvoie null si ce socket s'est
        // jamais authentifié pour ce code, et l'événement est juste ignoré
        const identityFor = (code) => {
            if (!isValidCode(code)) return null
            const upperCode = code.toUpperCase()
            if (typeof socket.data.playerId !== 'string' || socket.data.lobbyCode !== upperCode) return null
            return { code: upperCode, playerId: socket.data.playerId }
        }

        socket.on('game:submitTracks', (payload = {}) => {
            const { code, player, tracks } = payload
            const identity = identityFor(code)
            if (!identity) return
            try {
                // le nom/avatar viennent du payload (pas sensibles), mais
                // l'id du joueur c'est toujours celui du jeton vérifié
                gameService.submitTracks(identity.code, { ...player, id: identity.playerId }, tracks, io)
            } catch (err) {
                socket.emit('game:error', { message: errorMessage(err) })
            }
        })

        socket.on('game:start', async (payload = {}) => {
            const { code } = payload
            const identity = identityFor(code)
            if (!identity) return

            try {
                const lobby = await lobbyService.getLobby(identity.code)
                await gameService.startGame({ code: identity.code, playerId: identity.playerId, lobby: lobby.toPublic(), io })
            } catch (err) {
                socket.emit('game:error', { message: errorMessage(err) })
            }
        })

        socket.on('game:answer', (payload = {}) => {
            const { code, roundIndex, selected } = payload
            const identity = identityFor(code)
            if (!identity || typeof roundIndex !== 'number') return
            gameService.submitAnswer({ code: identity.code, playerId: identity.playerId, roundIndex, selected, io })
        })

        // sert que si le lobby a activé "avancer manuellement". sinon endRound
        // a déjà son propre timer et cet événement ne fait rien (advanceRound l'ignore)
        socket.on('game:nextRound', (payload = {}) => {
            const { code } = payload
            const identity = identityFor(code)
            if (!identity) return
            try {
                gameService.advanceRound({ code: identity.code, playerId: identity.playerId, io })
            } catch (err) {
                socket.emit('game:error', { message: errorMessage(err) })
            }
        })

        // pour qu'un client qui revient (reconnexion réseau, etc.) resynchronise
        // son affichage avec l'état actuel de la partie
        socket.on('game:sync', (code) => {
            const identity = identityFor(code)
            if (!identity) return
            socket.emit('game:state', gameService.getSnapshot(identity.code))
        })

        // le bouton "pas le bon extrait ?" sur l'écran de résultat. ça met à
        // jour la base de correspondances vérifiées (previewMatch.service.js),
        // mais ça change rien à la manche déjà jouée
        socket.on('game:reportWrongPreview', (payload = {}) => {
            const { code, roundIndex } = payload
            const identity = identityFor(code)
            if (!identity || typeof roundIndex !== 'number') return
            gameService.reportWrongPreview({ code: identity.code, playerId: identity.playerId, roundIndex })
        })

        // envoyé quand l'écran de lobby reprend le focus (retour des résultats
        // finaux, ou juste arrivée dans le lobby) : sort le joueur de la liste
        // d'attente ouverte par la partie précédente
        socket.on('game:confirmReturn', (payload = {}) => {
            const { code } = payload
            const identity = identityFor(code)
            if (!identity) return
            gameService.clearPendingReturn(identity.code, identity.playerId, io)
        })
    })
}
