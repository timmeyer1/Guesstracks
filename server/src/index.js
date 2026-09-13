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
// '*' ouvre l'API et le socket à n'importe quel site, ça passe en dev mais
// jamais en prod. dcp le serveur refuse carrément de démarrer si y'a pas
// de valeur explicite, plutôt que de retomber sur '*' en silence.
if (isProd && !process.env.CORS_ORIGIN) {
    throw new Error('CORS_ORIGIN doit être défini en production (voir server/.env.example)')
}
// si on passe une seule string au module `cors`, il la traite comme une
// valeur fixe et compare jamais avec l'origine de la requête. en gros faut
// découper la liste séparée par virgules (voir .env.example) en tableau
// pour que chaque origine soit vraiment vérifiée.
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

// les codes de lobby font que 4 caractères, donc peu de combinaisons possibles.
// sans limite de débit, on pourrait les bruteforcer pour rejoindre des
// lobbies au hasard.
const lobbyLimiter = rateLimit({
    windowMs: 60_000,
    max: 20, // 20 requêtes max par minute et par IP sur les routes de lobby
    standardHeaders: true,
    legacyHeaders: false,
})

app.use('/api', lobbyLimiter, createLobbyRouter(io))
// les limites de débit sont gérées route par route dans auth.routes.js : l'échange
// du token OAuth et la recherche de titres à la frappe, c'est pas du tout le même
// usage, une seule limite globale aurait été trop stricte pour l'une des deux.
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
