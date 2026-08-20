export const GAME_MODES = ['guesstracks', 'blindtest']
export const PHASE_SPEEDS = ['slow', 'normal', 'fast']

export const LOBBY_LIMITS = {
    MIN_ROUNDS: 5,
    MAX_ROUNDS: 20,
    MAX_PLAYERS: 12,
    MIN_PLAYERS_TO_START: 2,
}

export const DEFAULT_LOBBY_SETTINGS = {
    gameMode: 'guesstracks',
    rounds: 10,
    phaseSpeed: 'normal',
}

export const CODE_LENGTH = 4
// alphabet lisible : sans caractères ambigus (0/O, 1/I)
export const CODE_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'

// vitesse de phase -> durée de la manche en secondes (source de vérité serveur,
// dupliquée côté client pour l'affichage dans app/core/constants/lobby.constants.ts)
export const PHASE_DURATIONS = {
    slow: 30,
    normal: 15,
    fast: 7,
}

export const QUESTION_TYPES = {
    guesstracks: 'who_liked',
    blindtest: 'guess_track',
}

export const SCORING = {
    BASE_POINTS: 1000,
    MIN_SPEED_FACTOR: 0.3, // même à la dernière seconde, on garde 30% du multiplicateur de vitesse
    PERFECT_BONUS: 150, // manche identifiée à 100% sans erreur
    STREAK_BONUS_PER_LEVEL: 50, // par manche parfaite consécutive au-delà de la première
    STREAK_BONUS_CAP: 500,
}

export const ROUND_RESULTS_PAUSE_MS = 5000 // temps d'affichage des résultats entre deux manches
export const TRACK_SUBMIT_TIMEOUT_MS = 15000 // délai laissé aux joueurs pour envoyer leurs titres likés avant de démarrer avec ceux déjà reçus

export const MIN_ROUNDS_PLAYABLE = 3 // en dessous, la partie ne peut pas démarrer même si le pool est trop petit
