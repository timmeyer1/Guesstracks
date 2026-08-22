import 'dotenv/config'
import http from 'node:http'
import express from 'express'
import cors from 'cors'
import rateLimit from 'express-rate-limit'
import { Server } from 'socket.io'

import { connectDB } from './db.js'
import { createLobbyRouter } from './routes/lobby.routes.js'
import { createAuthRouter, AuthError } from './routes/auth.routes.js'
import { registerLobbySockets } from './sockets/index.js'
import { LobbyError } from './services/lobby.service.js'

const PORT = process.env.PORT || 4000
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/guesstracks'

const isProd = process.env.NODE_ENV === 'production'
// '*' ouvre l'API/le socket à n'importe quel site (cf. audit sécurité,
// finding I4) : acceptable en dev, jamais en prod — le serveur refuse de
// démarrer sans une valeur explicite plutôt que de retomber sur '*' en
// silence.
if (isProd && !process.env.CORS_ORIGIN) {
    throw new Error('CORS_ORIGIN doit être défini en production (voir server/.env.example)')
}
// une seule origine passée telle quelle au module `cors` est traitée comme
// une valeur fixe unique, jamais comparée à l'origine de la requête (cf.
// node_modules/cors/lib/index.js, configureOrigin) : une liste séparée par
// des virgules (documentée dans .env.example) doit donc être éclatée en
// tableau pour que chaque origine soit réellement vérifiée.
const corsOrigins = process.env.CORS_ORIGIN?.split(',').map((o) => o.trim()).filter(Boolean)
const CORS_ORIGIN = corsOrigins && corsOrigins.length > 0
    ? (corsOrigins.length === 1 ? corsOrigins[0] : corsOrigins)
    : '*'

const app = express()
app.use(cors({ origin: CORS_ORIGIN }))
app.use(express.json())

const httpServer = http.createServer(app)
const io = new Server(httpServer, {
    cors: { origin: CORS_ORIGIN },
})

app.get('/health', (req, res) => res.json({ ok: true }))

// les codes de lobby ne font que 4 caractères (32^4 combinaisons) : sans
// limite de débit, GET/join permettent de les brute-forcer pour rejoindre
// des lobbies au hasard (cf. audit sécurité, finding I3)
const lobbyLimiter = rateLimit({
    windowMs: 60_000,
    max: 20, // 20 requêtes/min/IP sur les routes de lobby
    standardHeaders: true,
    legacyHeaders: false,
})
const authLimiter = rateLimit({
    windowMs: 60_000,
    max: 10, // 10 requêtes/min/IP sur l'échange de token OAuth
    standardHeaders: true,
    legacyHeaders: false,
})

app.use('/api', lobbyLimiter, createLobbyRouter(io))
app.use('/api/auth', authLimiter, createAuthRouter())

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
