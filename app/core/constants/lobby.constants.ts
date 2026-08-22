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

// vitesses des phases
export const PHASE_SPEEDS = {
    slow: {
        label: 'Lent',
        duration: 30,
        durationLabel: '30s',
    },
    normal: {
        label: 'Normal',
        duration: 15,
        durationLabel: '15s',
    },
    fast: {
        label: 'Rapide',
        duration: 7,
        durationLabel: '7s',
    },
} as const satisfies Record<PhaseSpeed, { label: string; duration: number; durationLabel: string }>

// limites
export const LOBBY_LIMITS = {
    MIN_ROUNDS: 5,
    MAX_ROUNDS: 20,
    MIN_PLAYERS_TO_START: 2,
    MAX_PLAYERS: 12,
}

// paramètres par défaut
export const DEFAULT_LOBBY_SETTINGS = {
    gameMode: 'guesstracks' as GameMode,
    rounds: 10,
    phaseSpeed: 'normal' as PhaseSpeed,
    maxPlayers: LOBBY_LIMITS.MAX_PLAYERS,
}

// récupère le label d'un mode de jeu
export const getGameModeLabel = (mode: GameMode) => GAME_MODES[mode].label

// récupère le label d'une vitesse
export const getPhaseSpeedLabel = (speed: PhaseSpeed) => PHASE_SPEEDS[speed].label

// récupère la durée complète avec label
export const getPhaseSpeedFull = (speed: PhaseSpeed) =>
    `${PHASE_SPEEDS[speed].label} (${PHASE_SPEEDS[speed].durationLabel})`

// récupère toutes les infos d'un lobby sous forme de texte
export const getLobbyInfoText = (gameMode: GameMode, rounds: number, phaseSpeed: PhaseSpeed) =>
    `${GAME_MODES[gameMode].label} • ${rounds} manches • ${getPhaseSpeedFull(phaseSpeed)}`