import jwt from 'jsonwebtoken'

// Jeton liant une connexion à une identité de joueur au sein d'un lobby
// donné : émis à la création/l'entrée dans un lobby, rejoué par le client sur
// chaque requête REST (header Authorization) et chaque abonnement socket. Sans
// ça, playerId/requesterId venait tel quel du corps de la requête et n'importe
// qui pouvait usurper n'importe quel joueur (cf. audit sécurité, finding C1).
const SECRET = process.env.LOBBY_JWT_SECRET
if (!SECRET) {
    throw new Error(
        'LOBBY_JWT_SECRET doit être défini (voir server/.env.example) : ' +
        'requis pour signer les jetons de session de lobby.'
    )
}

const TOKEN_TTL = '6h'

export class LobbyTokenError extends Error {}

export const signLobbyToken = (code, playerId) =>
    jwt.sign({ code, playerId }, SECRET, { expiresIn: TOKEN_TTL })

// lève LobbyTokenError si le jeton est absent, invalide, expiré, ou ne
// correspond pas au code de lobby attendu
export const verifyLobbyToken = (rawToken, expectedCode) => {
    if (typeof rawToken !== 'string' || !rawToken) {
        throw new LobbyTokenError('Jeton de lobby manquant')
    }

    let payload
    try {
        payload = jwt.verify(rawToken, SECRET)
    } catch {
        throw new LobbyTokenError('Jeton de lobby invalide ou expiré')
    }

    if (typeof payload.code !== 'string' || typeof payload.playerId !== 'string') {
        throw new LobbyTokenError('Jeton de lobby malformé')
    }
    if (expectedCode && payload.code !== expectedCode) {
        throw new LobbyTokenError('Jeton de lobby ne correspondant pas à ce lobby')
    }

    return { code: payload.code, playerId: payload.playerId }
}
