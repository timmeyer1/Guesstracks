import mongoose from 'mongoose'
import { GAME_MODES, PHASE_SPEED_LIMITS, LOBBY_LIMITS, TRACK_ALGORITHMS } from '../constants.js'

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
    // si activé, la partie n'enchaîne plus automatiquement sur la manche
    // suivante après l'affichage des résultats : seul l'hôte peut continuer
    // (cf. game.service.js, endRound/advanceRound)
    manualAdvance: { type: Boolean, default: false },
    // mode blindtest uniquement (cf. constants.js et LobbySettingsModal) : sans
    // effet en who_liked (Who Liked It), où le titre est toujours affiché
    trackAlgorithm: { type: String, enum: TRACK_ALGORITHMS, default: 'random' },
    // le lobby a des valeurs par défaut dès sa création, mais tant que l'hôte
    // n'a pas explicitement validé les réglages, on ne veut pas les afficher
    // comme "choisis" aux autres joueurs (cf. LobbySettingsModal)
    settingsConfirmed: { type: Boolean, default: false },
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
        manualAdvance: this.manualAdvance,
        trackAlgorithm: this.trackAlgorithm,
        settingsConfirmed: this.settingsConfirmed,
        maxPlayers: this.maxPlayers,
        players: this.players,
    }
}

export const LobbyModel = mongoose.model('Lobby', lobbySchema)
