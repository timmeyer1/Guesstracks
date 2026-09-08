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
        // l'identité du joueur ne vient jamais du payload (falsifiable par le
        // client) mais de socket.data, fixé par lobby:subscribe après
        // vérification du jeton de lobby (cf. sockets/index.js) — renvoie null
        // si ce socket ne s'est jamais authentifié pour ce code précis, ce qui
        // ignore silencieusement l'événement (même comportement que les gardes
        // de validation déjà présentes plus bas)
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
                // le nom/avatar affichés viennent du payload (non sensibles),
                // mais l'id du joueur est toujours celui du jeton vérifié
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

        // uniquement utilisé quand le lobby a activé "avancer manuellement"
        // (cf. game.manualAdvance) : sans quoi endRound arme déjà son propre
        // timer et cet événement n'a aucun effet (advanceRound l'ignore)
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

        // permet à un client qui vient de (re)rejoindre la room de resynchroniser
        // son affichage sur l'état de partie en cours (reconnexion réseau, etc.)
        socket.on('game:sync', (code) => {
            const identity = identityFor(code)
            if (!identity) return
            socket.emit('game:state', gameService.getSnapshot(identity.code))
        })

        // "Pas le bon extrait ?" sur l'écran de résultat (cf. RoundResult.tsx) :
        // alimente la base globale de correspondances vérifiées (cf.
        // previewMatch.service.js), sans effet sur la manche déjà jouée
        socket.on('game:reportWrongPreview', (payload = {}) => {
            const { code, roundIndex } = payload
            const identity = identityFor(code)
            if (!identity || typeof roundIndex !== 'number') return
            gameService.reportWrongPreview({ code: identity.code, playerId: identity.playerId, roundIndex })
        })

        // envoyé quand l'écran de lobby regagne le focus (retour depuis les
        // résultats finaux, ou simple arrivée dans le lobby) : sort le joueur
        // de la liste d'attente ouverte par la fin d'une partie précédente
        socket.on('game:confirmReturn', (payload = {}) => {
            const { code } = payload
            const identity = identityFor(code)
            if (!identity) return
            gameService.clearPendingReturn(identity.code, identity.playerId, io)
        })
    })
}
