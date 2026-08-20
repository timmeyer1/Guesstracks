export const GAME_MODES = ['guesstracks', 'blindtest']
export const PHASE_SPEEDS = ['slow', 'normal', 'fast']

export const LOBBY_LIMITS = {
    MIN_ROUNDS: 5,
    MAX_ROUNDS: 20,
    MAX_PLAYERS: 12,
}

export const DEFAULT_LOBBY_SETTINGS = {
    gameMode: 'guesstracks',
    rounds: 10,
    phaseSpeed: 'normal',
}

export const CODE_LENGTH = 4
// alphabet lisible : sans caractères ambigus (0/O, 1/I)
export const CODE_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'
