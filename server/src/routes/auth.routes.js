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

// échange OAuth : rare et déjà protégé par le code éphémère Deezer lui-même,
// une limite serrée n'entrave donc aucun usage légitime
const tokenLimiter = rateLimit({
    windowMs: 60_000,
    max: 10, // 10 requêtes/min/IP
    standardHeaders: true,
    legacyHeaders: false,
})
// recherche à la frappe (cf. app/components/auth/ManualTrackPickerModal.tsx) :
// plusieurs requêtes par utilisateur en quelques secondes le temps de taper
// une recherche, une limite aussi stricte que tokenLimiter la bloquerait
// avant même une seule recherche complète
const searchLimiter = rateLimit({
    windowMs: 60_000,
    max: 30, // 30 requêtes/min/IP
    standardHeaders: true,
    legacyHeaders: false,
})

// Deezer n'expose pas de flux PKCE pour client public (contrairement à
// Spotify, cf. app/modules/auth/spotify.ts) : l'échange code -> token exige
// le secret d'app Deezer, qui ne doit donc jamais être embarqué côté mobile.
// Ce endpoint fait cet échange côté serveur et ne renvoie que le token.
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
                // ancien format d'erreur Deezer : texte brut (ex: "wrong code")
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

    // recherche de titres dans le catalogue Deezer, groupée par album et
    // proxyée côté serveur (cf. deezer.service.js/searchTracksGroupedByAlbum
    // pour le pourquoi) — utilisée par la connexion universelle pour laisser
    // un joueur choisir lui-même ses titres, sans compte streaming
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
