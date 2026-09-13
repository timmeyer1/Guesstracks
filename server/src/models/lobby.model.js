import mongoose from 'mongoose'
import { GAME_MODES, PHASE_SPEED_LIMITS, LOBBY_LIMITS } from '../constants.js'

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
    gameMode: { type: String, enum: GAME_MODES, default: 'who_liked' },
    rounds: { type: Number, min: LOBBY_LIMITS.MIN_ROUNDS, max: LOBBY_LIMITS.MAX_ROUNDS, default: 10 },
    phaseSpeed: { type: Number, min: PHASE_SPEED_LIMITS.MIN, max: PHASE_SPEED_LIMITS.MAX, default: 15 },
    // si activé, ça n'enchaîne pas tout seul sur la manche suivante après
    // les résultats, faut que l'hôte clique (voir endRound/advanceRound dans game.service.js)
    manualAdvance: { type: Boolean, default: false },
    // le lobby a des réglages par défaut dès sa création, mais tant que
    // l'hôte les a pas validés on veut pas les montrer comme "choisis" aux autres
    settingsConfirmed: { type: Boolean, default: false },
    maxPlayers: { type: Number, default: LOBBY_LIMITS.MAX_PLAYERS, max: LOBBY_LIMITS.MAX_PLAYERS },
    players: { type: [playerSchema], default: [] },
    createdAt: { type: Date, default: Date.now, expires: '6h' },
})

// en gros le premier joueur du tableau, c'est toujours l'hôte
lobbySchema.methods.toPublic = function toPublic() {
    return {
        code: this.code,
        name: this.name,
        gameMode: this.gameMode,
        rounds: this.rounds,
        phaseSpeed: this.phaseSpeed,
        manualAdvance: this.manualAdvance,
        settingsConfirmed: this.settingsConfirmed,
        maxPlayers: this.maxPlayers,
        players: this.players,
    }
}

export const LobbyModel = mongoose.model('Lobby', lobbySchema)
