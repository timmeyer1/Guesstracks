import { GameMode, PhaseSpeed } from '../types'

// mode de jeu
export const GAME_MODES = {
    guesstracks: {
        label: 'Guesstracks',
        icon: '🎼', // TODO: mettre nos propres icones
        // description: '',
    },
    blindtest: {
        label: 'Blindtest',
        icon: '💡',
        // description: '',
    },
} as const satisfies Record<GameMode, { label: string; icon: string }>

// limites
export const LOBBY_LIMITS = {
    MIN_ROUNDS: 5,
    MAX_ROUNDS: 30,
    ROUNDS_STEP: 5,
    MIN_PLAYERS_TO_START: 2,
    MAX_PLAYERS: 12,
    // vitesse des phases : durée d'une manche en secondes
    MIN_PHASE_SPEED: 5,
    MAX_PHASE_SPEED: 30,
    PHASE_SPEED_STEP: 5,
}

// paramètres par défaut
export const DEFAULT_LOBBY_SETTINGS = {
    gameMode: 'guesstracks' as GameMode,
    rounds: 10,
    phaseSpeed: 15 as PhaseSpeed,
    maxPlayers: LOBBY_LIMITS.MAX_PLAYERS,
}

// récupère le label d'un mode de jeu
export const getGameModeLabel = (mode: GameMode) => GAME_MODES[mode].label

// récupère le label d'une vitesse (durée en secondes d'une phase)
export const getPhaseSpeedLabel = (speed: PhaseSpeed) => `${speed}s`

// récupère toutes les infos d'un lobby sous forme de texte
export const getLobbyInfoText = (gameMode: GameMode, rounds: number, phaseSpeed: PhaseSpeed) =>
    `${GAME_MODES[gameMode].label} • ${rounds} manches • ${getPhaseSpeedLabel(phaseSpeed)}`
