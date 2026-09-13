import { LobbyModel } from '../models/lobby.model.js'
import { generateUniqueLobbyCode } from '../utils/generateCode.js'
import { GAME_MODES, PHASE_SPEED_LIMITS, LOBBY_LIMITS, DEFAULT_LOBBY_SETTINGS } from '../constants.js'

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
        manualAdvance: DEFAULT_LOBBY_SETTINGS.manualAdvance,
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

// renvoie { closed: true } si le lobby a été supprimé (plus personne dedans)
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
        const phaseSpeed = Number(settings.phaseSpeed)
        if (
            !Number.isInteger(phaseSpeed) ||
            phaseSpeed < PHASE_SPEED_LIMITS.MIN ||
            phaseSpeed > PHASE_SPEED_LIMITS.MAX ||
            phaseSpeed % PHASE_SPEED_LIMITS.STEP !== 0
        ) {
            throw new LobbyError('Vitesse de phase invalide')
        }
        lobby.phaseSpeed = phaseSpeed
    }

    if (settings.rounds !== undefined) {
        const rounds = Number(settings.rounds)
        if (
            !Number.isInteger(rounds) ||
            rounds < LOBBY_LIMITS.MIN_ROUNDS ||
            rounds > LOBBY_LIMITS.MAX_ROUNDS ||
            rounds % LOBBY_LIMITS.ROUNDS_STEP !== 0
        ) {
            throw new LobbyError('Nombre de manches invalide')
        }
        lobby.rounds = rounds
    }

    if (settings.manualAdvance !== undefined) {
        lobby.manualAdvance = Boolean(settings.manualAdvance)
    }

    lobby.settingsConfirmed = true
    await lobby.save()
    return lobby.toPublic()
}

// en gros le premier joueur du tableau, c'est toujours l'hôte (voir lobby.model.js)
export const kickPlayer = async (code, requesterId, targetId) => {
    const lobby = await getLobby(code)

    const isHost = lobby.players[0]?.id === requesterId
    if (!isHost) {
        throw new LobbyError("Seul l'hôte peut expulser un joueur", 403)
    }
    if (requesterId === targetId) {
        throw new LobbyError("Tu ne peux pas t'expulser toi-même")
    }

    const before = lobby.players.length
    lobby.players = lobby.players.filter((p) => p.id !== targetId)
    if (lobby.players.length === before) {
        throw new LobbyError('Joueur introuvable', 404)
    }

    await lobby.save()
    return lobby.toPublic()
}

// vire plusieurs joueurs d'un coup, sans check d'hôte : c'est le nettoyage
// auto pour inactivité qui appelle ça (game.service.js), pas un joueur.
// une seule opération atomique ($pull avec $in) plutôt qu'une boucle,
// sinon une écriture concurrente pouvait écraser un retrait en cours.
// renvoie removed:false si le lobby existe plus, sinon removed:true avec
// closed:true (lobby vide, supprimé) ou closed:false + lobby.
export const removePlayers = async (code, targetIds) => {
    if (!Array.isArray(targetIds) || targetIds.length === 0) return { removed: false }

    const lobby = await LobbyModel.findOneAndUpdate(
        { code },
        { $pull: { players: { id: { $in: targetIds } } } },
        { new: true }
    )
    if (!lobby) return { removed: false }

    if (lobby.players.length === 0) {
        await lobby.deleteOne()
        return { removed: true, closed: true }
    }

    return { removed: true, closed: false, lobby: lobby.toPublic() }
}

export const transferHost = async (code, requesterId, targetId) => {
    const lobby = await getLobby(code)

    const isHost = lobby.players[0]?.id === requesterId
    if (!isHost) {
        throw new LobbyError("Seul l'hôte peut transférer son rôle", 403)
    }

    const targetIndex = lobby.players.findIndex((p) => p.id === targetId)
    if (targetIndex === -1) {
        throw new LobbyError('Joueur introuvable', 404)
    }
    if (targetIndex === 0) {
        return lobby.toPublic()
    }

    const [target] = lobby.players.splice(targetIndex, 1)
    lobby.players.unshift(target)

    await lobby.save()
    return lobby.toPublic()
}
