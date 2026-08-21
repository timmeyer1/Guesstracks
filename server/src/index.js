import 'dotenv/config'
import http from 'node:http'
import express from 'express'
import cors from 'cors'
import { Server } from 'socket.io'

import { connectDB } from './db.js'
import { createLobbyRouter } from './routes/lobby.routes.js'
import { createAuthRouter, AuthError } from './routes/auth.routes.js'
import { registerLobbySockets } from './sockets/index.js'
import { LobbyError } from './services/lobby.service.js'

const PORT = process.env.PORT || 4000
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/guesstracks'
const CORS_ORIGIN = process.env.CORS_ORIGIN || '*'

const app = express()
app.use(cors({ origin: CORS_ORIGIN }))
app.use(express.json())

const httpServer = http.createServer(app)
const io = new Server(httpServer, {
    cors: { origin: CORS_ORIGIN },
})

app.get('/health', (req, res) => res.json({ ok: true }))
app.use('/api', createLobbyRouter(io))
app.use('/api/auth', createAuthRouter())

app.use((req, res) => {
    res.status(404).json({ error: 'Route introuvable' })
})

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
    if (err instanceof LobbyError || err instanceof AuthError) {
        return res.status(err.status).json({ error: err.message })
    }
    console.error('❌ Erreur serveur:', err)
    res.status(500).json({ error: 'Erreur serveur' })
})

registerLobbySockets(io)

const start = async () => {
    await connectDB(MONGODB_URI)
    httpServer.listen(PORT, () => {
        console.log(`🚀 Serveur de lobby lancé sur le port ${PORT}`)
    })
}

start().catch((err) => {
    console.error('❌ Échec du démarrage du serveur:', err)
    process.exit(1)
})
