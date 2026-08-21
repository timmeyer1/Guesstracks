import { Router } from 'express'
import * as lobbyService from '../services/lobby.service.js'
import { cleanupGame, clearPendingReturn } from '../services/game.service.js'

export const createLobbyRouter = (io) => {
    const router = Router()

    const broadcast = (code, lobby) => {
        io.to(`lobby:${code}`).emit('lobby:update', lobby)
    }

    router.post('/lobbies', async (req, res, next) => {
        try {
            const lobby = await lobbyService.createLobby(req.body.player)
            res.status(201).json({ lobby })
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
            broadcast(code, lobby)
            res.json({ lobby })
        } catch (err) {
            next(err)
        }
    })

    router.post('/lobbies/:code/leave', async (req, res, next) => {
        try {
            const code = req.params.code.toUpperCase()
            const result = await lobbyService.leaveLobby(code, req.body.playerId)
            if (result.closed) {
                cleanupGame(code)
                io.to(`lobby:${code}`).emit('lobby:closed')
            } else {
                broadcast(code, result.lobby)
                // un joueur qui quitte n'a plus besoin d'être attendu pour relancer
                clearPendingReturn(code, req.body.playerId, io)
            }
            res.json(result)
        } catch (err) {
            next(err)
        }
    })

    router.patch('/lobbies/:code/settings', async (req, res, next) => {
        try {
            const code = req.params.code.toUpperCase()
            const { playerId, ...settings } = req.body
            const lobby = await lobbyService.updateLobbySettings(code, playerId, settings)
            broadcast(code, lobby)
            res.json({ lobby })
        } catch (err) {
            next(err)
        }
    })

    router.post('/lobbies/:code/kick', async (req, res, next) => {
        try {
            const code = req.params.code.toUpperCase()
            const lobby = await lobbyService.kickPlayer(code, req.body.requesterId, req.body.targetId)
            broadcast(code, lobby)
            // un joueur expulsé n'a plus besoin d'être attendu pour relancer
            clearPendingReturn(code, req.body.targetId, io)
            res.json({ lobby })
        } catch (err) {
            next(err)
        }
    })

    router.post('/lobbies/:code/transfer-host', async (req, res, next) => {
        try {
            const code = req.params.code.toUpperCase()
            const lobby = await lobbyService.transferHost(code, req.body.requesterId, req.body.targetId)
            broadcast(code, lobby)
            res.json({ lobby })
        } catch (err) {
            next(err)
        }
    })

    return router
}
