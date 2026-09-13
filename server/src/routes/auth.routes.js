import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import { searchTracksGroupedByAlbum } from '../services/deezer.service.js'

export class AuthError extends Error {
    constructor(message, status = 400) {
        super(message)
        this.status = status
    }
}

const DEEZER_TOKEN_URL = 'https://connect.deezer.com/oauth/access_token.php'

// l'échange OAuth c'est rare et déjà protégé par le code éphémère Deezer,
// donc on peut mettre une limite serrée sans gêner personne
const tokenLimiter = rateLimit({
    windowMs: 60_000,
    max: 10, // 10 requêtes max par minute et par IP
    standardHeaders: true,
    legacyHeaders: false,
})
// en gros la recherche à la frappe envoie plusieurs requêtes en quelques
// secondes, donc une limite aussi stricte que tokenLimiter bloquerait
// une recherche avant même qu'elle soit finie
const searchLimiter = rateLimit({
    windowMs: 60_000,
    max: 30, // 30 requêtes max par minute et par IP
    standardHeaders: true,
    legacyHeaders: false,
})

// Deezer (contrairement à Spotify) n'a pas de flux PKCE pour une app mobile :
// dcp l'échange code -> token demande le secret de l'appli, qui doit jamais
// se retrouver dans le code du mobile. Cette route fait l'échange côté
// serveur et ne renvoie que le token à l'app.
export const createAuthRouter = () => {
    const router = Router()

    router.post('/deezer/token', tokenLimiter, async (req, res, next) => {
        try {
            const { code, redirectUri } = req.body

            if (typeof code !== 'string' || !code.trim()) {
                throw new AuthError('Code Deezer manquant')
            }

            const appId = process.env.DEEZER_APP_ID
            const secret = process.env.DEEZER_APP_SECRET
            if (!appId || !secret) {
                throw new AuthError('Connexion Deezer non configurée côté serveur', 500)
            }

            const url = new URL(DEEZER_TOKEN_URL)
            url.searchParams.set('app_id', appId)
            url.searchParams.set('secret', secret)
            url.searchParams.set('code', code)
            url.searchParams.set('output', 'json')
            if (typeof redirectUri === 'string' && redirectUri.trim()) {
                url.searchParams.set('redirect_uri', redirectUri)
            }

            const deezerResponse = await fetch(url)
            const text = await deezerResponse.text()

            let data
            try {
                data = JSON.parse(text)
            } catch {
                // vieux format d'erreur Deezer : juste du texte brut (ex: "wrong code")
                throw new AuthError(text || 'Échec de connexion Deezer')
            }

            if (!deezerResponse.ok || data.error || !data.access_token) {
                const message =
                    (typeof data.error === 'string' && data.error) ||
                    data.error_description ||
                    data.error?.message ||
                    'Échec de connexion Deezer'
                throw new AuthError(message)
            }

            res.json({ access_token: data.access_token, expires: data.expires ?? 0 })
        } catch (err) {
            next(err)
        }
    })

    // recherche de titres Deezer groupés par album, on passe par le serveur
    // (voir deezer.service.js pour le pourquoi). Utilisé par la connexion
    // universelle, pour les joueurs qui choisissent leurs titres à la main
    // sans compte streaming.
    router.get('/search-tracks', searchLimiter, async (req, res, next) => {
        try {
            const { q } = req.query

            if (typeof q !== 'string' || !q.trim()) {
                return res.json({ albums: [], similarArtists: [] })
            }

            const { albums, similarArtists } = await searchTracksGroupedByAlbum(q)
            res.json({ albums, similarArtists })
        } catch (err) {
            next(err)
        }
    })

    return router
}
