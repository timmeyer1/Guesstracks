import mongoose from 'mongoose'
import { GAME_MODES, PHASE_SPEEDS, LOBBY_LIMITS } from '../constants.js'

const playerSchema = new mongoose.Schema(
    {
        id: { type: String, required: true },
        name: { type: String, required: true, trim: true, maxlength: 60 },
        img: { type: String, default: null },
        accountType: { type: String, default: null },
    },
    { _id: false }
)

const lobbySchema = new mongoose.Schema({
    code: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 60 },
    gameMode: { type: String, enum: GAME_MODES, default: 'guesstracks' },
    rounds: { type: Number, min: LOBBY_LIMITS.MIN_ROUNDS, max: LOBBY_LIMITS.MAX_ROUNDS, default: 10 },
    phaseSpeed: { type: String, enum: PHASE_SPEEDS, default: 'normal' },
    maxPlayers: { type: Number, default: LOBBY_LIMITS.MAX_PLAYERS, max: LOBBY_LIMITS.MAX_PLAYERS },
    players: { type: [playerSchema], default: [] },
    createdAt: { type: Date, default: Date.now, expires: '6h' },
})

// le premier joueur du tableau est toujours l'hôte
lobbySchema.methods.toPublic = function toPublic() {
    return {
        code: this.code,
        name: this.name,
        gameMode: this.gameMode,
        rounds: this.rounds,
        phaseSpeed: this.phaseSpeed,
        maxPlayers: this.maxPlayers,
        players: this.players,
    }
}

export const LobbyModel = mongoose.model('Lobby', lobbySchema)
