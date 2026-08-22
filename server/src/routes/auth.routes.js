import { Router } from 'express'

export class AuthError extends Error {
    constructor(message, status = 400) {
        super(message)
        this.status = status
    }
}

const DEEZER_TOKEN_URL = 'https://connect.deezer.com/oauth/access_token.php'

// Deezer n'expose pas de flux PKCE pour client public (contrairement à
// Spotify, cf. app/modules/auth/spotify.ts) : l'échange code -> token exige
// le secret d'app Deezer, qui ne doit donc jamais être embarqué côté mobile.
// Ce endpoint fait cet échange côté serveur et ne renvoie que le token.
export const createAuthRouter = () => {
    const router = Router()

    router.post('/deezer/token', async (req, res, next) => {
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

    return router
}
