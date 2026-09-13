import { Router } from 'express'
import * as lobbyService from '../services/lobby.service.js'
import { cleanupGame, clearPendingReturn } from '../services/game.service.js'
import { signLobbyToken, verifyLobbyToken, LobbyTokenError } from '../utils/lobbyToken.js'

export const createLobbyRouter = (io) => {
    const router = Router()

    const broadcast = (code, lobby) => {
        io.to(`lobby:${code}`).emit('lobby:update', lobby)
    }

    // vérifie le jeton du lobby et met l'identité vérifiée dans req.playerId.
    // c'est la seule source fiable pour savoir qui appelle la route, jamais
    // req.body.playerId (ça vient du client, donc n'importe qui peut le trafiquer).
    const requireLobbyIdentity = (req, res, next) => {
        try {
            const raw = req.headers.authorization?.replace(/^Bearer\s+/i, '')
            const { playerId } = verifyLobbyToken(raw, req.params.code.toUpperCase())
            req.playerId = playerId
            next()
        } catch (err) {
            res.status(401).json({
                error: err instanceof LobbyTokenError ? err.message : 'Session de lobby invalide',
            })
        }
    }

    router.post('/lobbies', async (req, res, next) => {
        try {
            const lobby = await lobbyService.createLobby(req.body.player)
            const token = signLobbyToken(lobby.code, req.body.player.id)
            res.status(201).json({ lobby, token })
        } catch (err) {
            next(err)
        }
    })

    router.get('/lobbies/:code', async (req, res, next) => {
        try {
            const lobby = await lobbyService.getLobby(req.params.code.toUpperCase())
            res.json({ lobby: lobby.toPublic() })
        } catch (err) {
            next(err)
        }
    })

    router.post('/lobbies/:code/join', async (req, res, next) => {
        try {
            const code = req.params.code.toUpperCase()
            const lobby = await lobbyService.joinLobby(code, req.body.player)
            const token = signLobbyToken(code, req.body.player.id)
            broadcast(code, lobby)
            res.json({ lobby, token })
        } catch (err) {
            next(err)
        }
    })

    router.post('/lobbies/:code/leave', requireLobbyIdentity, async (req, res, next) => {
        try {
            const code = req.params.code.toUpperCase()
            const result = await lobbyService.leaveLobby(code, req.playerId)
            if (result.closed) {
                cleanupGame(code)
                io.to(`lobby:${code}`).emit('lobby:closed')
            } else {
                broadcast(code, result.lobby)
                // pas la peine d'attendre ce joueur pour relancer la partie, il est parti
                clearPendingReturn(code, req.playerId, io)
            }
            res.json(result)
        } catch (err) {
            next(err)
        }
    })

    router.patch('/lobbies/:code/settings', requireLobbyIdentity, async (req, res, next) => {
        try {
            const code = req.params.code.toUpperCase()
            const lobby = await lobbyService.updateLobbySettings(code, req.playerId, req.body)
            broadcast(code, lobby)
            res.json({ lobby })
        } catch (err) {
            next(err)
        }
    })

    router.post('/lobbies/:code/kick', requireLobbyIdentity, async (req, res, next) => {
        try {
            const code = req.params.code.toUpperCase()
            const lobby = await lobbyService.kickPlayer(code, req.playerId, req.body.targetId)
            broadcast(code, lobby)
            // pareil, pas la peine d'attendre un joueur expulsé pour relancer la partie
            clearPendingReturn(code, req.body.targetId, io)
            res.json({ lobby })
        } catch (err) {
            next(err)
        }
    })

    router.post('/lobbies/:code/transfer-host', requireLobbyIdentity, async (req, res, next) => {
        try {
            const code = req.params.code.toUpperCase()
            const lobby = await lobbyService.transferHost(code, req.playerId, req.body.targetId)
            broadcast(code, lobby)
            res.json({ lobby })
        } catch (err) {
            next(err)
        }
    })

    return router
}
