import jwt from 'jsonwebtoken'

// ce jeton prouve qu'un joueur est bien celui qu'il prétend être dans un lobby.
// on le crée à la création/l'entrée dans le lobby, et le client le renvoie à
// chaque requête (header Authorization) et chaque connexion socket. sans ça,
// n'importe qui pouvait se faire passer pour un autre joueur en trafiquant sa requête.
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

// plante avec LobbyTokenError si le jeton manque, est invalide/expiré,
// ou ne correspond pas au bon lobby
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
