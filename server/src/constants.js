export const GAME_MODES = ['who_liked', 'blindtest']

export const LOBBY_LIMITS = {
    MIN_ROUNDS: 5,
    MAX_ROUNDS: 30,
    ROUNDS_STEP: 5,
    MAX_PLAYERS: 12,
    MIN_PLAYERS_TO_START: 2,
}

// durée d'une manche en secondes, en gros la vitesse du jeu.
// Le serveur fait foi, le client a une copie dans lobby.constants.ts
export const PHASE_SPEED_LIMITS = {
    MIN: 5,
    MAX: 30,
    STEP: 5,
}

export const DEFAULT_LOBBY_SETTINGS = {
    gameMode: 'who_liked',
    rounds: 10,
    phaseSpeed: 15,
    manualAdvance: false,
}

export const CODE_LENGTH = 4
// alphabet sans les caractères qui se ressemblent trop (0/O, 1/I)
export const CODE_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'

export const QUESTION_TYPES = {
    who_liked: 'who_liked',
    blindtest: 'guess_track',
}

export const SCORING = {
    BASE_POINTS: 1000,
    MIN_SPEED_FACTOR: 0.3, // même à la dernière seconde, on garde 30% du bonus de vitesse
    PERFECT_BONUS: 150, // bonus si tu trouves tout juste du premier coup
    STREAK_BONUS_PER_LEVEL: 50, // bonus qui monte à chaque manche parfaite d'affilée (à partir de la 2e)
    STREAK_BONUS_CAP: 500,
}

export const ROUND_RESULTS_PAUSE_MS = 7000 // combien de temps on affiche les résultats avant la manche suivante

// quand tout le monde a répondu, on n'affiche pas les résultats direct,
// on laisse ce petit délai. Mais seulement si le chrono normal de la manche
// avait encore plus de temps que ça devant lui, sinon on n'ajoute rien
// (voir submitAnswer dans game.service.js)
export const ROUND_ANSWER_GRACE_MS = 3000

// dcp on n'envoie pas l'heure de lecture pile à Date.now(), on ajoute ce délai.
// en gros sans ça, chaque appareil lance le son dès que son buffer est prêt,
// et comme le réseau de chacun varie, tout le monde entend le son décalé.
// ce petit délai laisse le temps à tout le monde de charger l'extrait avant
// l'heure de lecture commune (voir AudioPlayer.tsx côté client)
export const AUDIO_SYNC_LEAD_MS = 1000

export const TRACK_SUBMIT_TIMEOUT_MS = 15000 // temps laissé aux joueurs pour envoyer leurs titres likés, on démarre avec ce qu'on a passé ce délai

// après la fin d'une partie, on laisse ce temps aux joueurs pour revenir au
// lobby (ou partir). Passé ce délai, ceux qui n'ont toujours rien fait
// sont virés pour inactivité.
export const RETURN_TO_LOBBY_TIMEOUT_MS = 30000

export const MIN_ROUNDS_PLAYABLE = 3 // en dessous de ce nombre de manches, impossible de lancer la partie

// en blindtest on essaie de répartir les manches équitablement entre les
// joueurs actifs, sur leurs titres likés en exclu (un titre liké par plusieurs
// comptes ne compte pour personne). Ce facteur est le vrai garde-fou : personne
// ne dépasse jamais FACTOR fois sa part normale (ex: 60% max à 2 joueurs).
// si son pool de titres exclusifs est trop petit, on prend ce qu'il y a plutôt que rien.
export const FAIRNESS_MAX_SHARE_FACTOR = 1.2
