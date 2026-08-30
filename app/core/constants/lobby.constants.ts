import { GameMode, PhaseSpeed, TrackAlgorithm } from '../types'

// mode de jeu
export const GAME_MODES = {
    who_liked: {
        label: 'Who Liked It',
        icon: '🎼', // TODO: mettre nos propres icones
        // description: '',
    },
    blindtest: {
        label: 'Blindtest',
        icon: '💡',
        // description: '',
    },
} as const satisfies Record<GameMode, { label: string; icon: string }>

// algorithme de sélection des titres (mode blindtest uniquement, cf.
// LobbySettingsModal) — labels affichés dans le sélecteur de réglages
export const TRACK_ALGORITHMS = {
    random: {
        label: 'Complètement aléatoire',
        description: 'Les titres sont tirés au hasard, sans autre contrainte',
    },
    known_half: {
        label: '1 titre connu de tous / 2',
        description: 'Un titre sur deux sera aimé par plusieurs joueurs',
    },
    known_third: {
        label: '1 titre connu de tous / 3',
        description: 'Un titre sur trois sera aimé par plusieurs joueurs',
    },
} as const satisfies Record<TrackAlgorithm, { label: string; description: string }>

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
    gameMode: 'who_liked' as GameMode,
    rounds: 10,
    phaseSpeed: 15 as PhaseSpeed,
    manualAdvance: false,
    trackAlgorithm: 'random' as TrackAlgorithm,
    maxPlayers: LOBBY_LIMITS.MAX_PLAYERS,
}

// récupère le label d'un mode de jeu
export const getGameModeLabel = (mode: GameMode) => GAME_MODES[mode].label

// récupère le label d'une vitesse (durée en secondes d'une phase)
export const getPhaseSpeedLabel = (speed: PhaseSpeed) => `${speed}s`

// récupère toutes les infos d'un lobby sous forme de texte
export const getLobbyInfoText = (gameMode: GameMode, rounds: number, phaseSpeed: PhaseSpeed) =>
    `${GAME_MODES[gameMode].label} • ${rounds} manches • ${getPhaseSpeedLabel(phaseSpeed)}`
