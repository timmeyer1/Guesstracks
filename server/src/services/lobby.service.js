import { LobbyModel } from '../models/lobby.model.js'
import { generateUniqueLobbyCode } from '../utils/generateCode.js'
import { GAME_MODES, PHASE_SPEEDS, LOBBY_LIMITS, DEFAULT_LOBBY_SETTINGS } from '../constants.js'

export class LobbyError extends Error {
    constructor(message, status = 400) {
        super(message)
        this.status = status
    }
}

const validatePlayer = (player) => {
    if (!player || typeof player.id !== 'string' || !player.id.trim()) {
        throw new LobbyError('Joueur invalide')
    }
    if (typeof player.name !== 'string' || !player.name.trim()) {
        throw new LobbyError('Nom de joueur invalide')
    }
}

export const createLobby = async (player) => {
    validatePlayer(player)
    const code = await generateUniqueLobbyCode()

    const lobby = await LobbyModel.create({
        code,
        name: player.name,
        gameMode: DEFAULT_LOBBY_SETTINGS.gameMode,
        rounds: DEFAULT_LOBBY_SETTINGS.rounds,
        phaseSpeed: DEFAULT_LOBBY_SETTINGS.phaseSpeed,
        maxPlayers: LOBBY_LIMITS.MAX_PLAYERS,
        players: [
            {
                id: player.id,
                name: player.name,
                img: player.img ?? null,
                accountType: player.accountType ?? null,
            },
        ],
    })

    return lobby.toPublic()
}

export const getLobby = async (code) => {
    const lobby = await LobbyModel.findOne({ code })
    if (!lobby) throw new LobbyError('Lobby introuvable', 404)
    return lobby
}

export const joinLobby = async (code, player) => {
    validatePlayer(player)
    const lobby = await getLobby(code)

    const alreadyIn = lobby.players.some((p) => p.id === player.id)
    if (alreadyIn) {
        return lobby.toPublic()
    }

    if (lobby.players.length >= lobby.maxPlayers) {
        throw new LobbyError('Ce lobby est complet', 409)
    }

    lobby.players.push({
        id: player.id,
        name: player.name,
        img: player.img ?? null,
        accountType: player.accountType ?? null,
    })
    await lobby.save()

    return lobby.toPublic()
}

// retourne { closed: true } si le lobby a été supprimé (plus aucun joueur)
export const leaveLobby = async (code, playerId) => {
    const lobby = await getLobby(code)

    lobby.players = lobby.players.filter((p) => p.id !== playerId)

    if (lobby.players.length === 0) {
        await lobby.deleteOne()
        return { closed: true, lobby: null }
    }

    await lobby.save()
    return { closed: false, lobby: lobby.toPublic() }
}

export const updateLobbySettings = async (code, playerId, settings) => {
    const lobby = await getLobby(code)

    const isHost = lobby.players[0]?.id === playerId
    if (!isHost) {
        throw new LobbyError("Seul l'hôte peut modifier les paramètres", 403)
    }

    if (settings.gameMode !== undefined) {
        if (!GAME_MODES.includes(settings.gameMode)) {
            throw new LobbyError('Mode de jeu invalide')
        }
        lobby.gameMode = settings.gameMode
    }

    if (settings.phaseSpeed !== undefined) {
        if (!PHASE_SPEEDS.includes(settings.phaseSpeed)) {
            throw new LobbyError('Vitesse de phase invalide')
        }
        lobby.phaseSpeed = settings.phaseSpeed
    }

    if (settings.rounds !== undefined) {
        const rounds = Number(settings.rounds)
        if (!Number.isInteger(rounds) || rounds < LOBBY_LIMITS.MIN_ROUNDS || rounds > LOBBY_LIMITS.MAX_ROUNDS) {
            throw new LobbyError('Nombre de manches invalide')
        }
        lobby.rounds = rounds
    }

    await lobby.save()
    return lobby.toPublic()
}
