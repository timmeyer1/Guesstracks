export const GAME_MODES = ['who_liked', 'blindtest']

export const LOBBY_LIMITS = {
    MIN_ROUNDS: 5,
    MAX_ROUNDS: 30,
    ROUNDS_STEP: 5,
    MAX_PLAYERS: 12,
    MIN_PLAYERS_TO_START: 2,
}

// vitesse des phases : durée d'une manche en secondes (source de vérité
// serveur, dupliquée côté client dans app/core/constants/lobby.constants.ts)
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
// alphabet lisible : sans caractères ambigus (0/O, 1/I)
export const CODE_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'

export const QUESTION_TYPES = {
    who_liked: 'who_liked',
    blindtest: 'guess_track',
}

export const SCORING = {
    BASE_POINTS: 1000,
    MIN_SPEED_FACTOR: 0.3, // même à la dernière seconde, on garde 30% du multiplicateur de vitesse
    PERFECT_BONUS: 150, // manche identifiée à 100% sans erreur
    STREAK_BONUS_PER_LEVEL: 50, // par manche parfaite consécutive au-delà de la première
    STREAK_BONUS_CAP: 500,
}

export const ROUND_RESULTS_PAUSE_MS = 7000 // temps d'affichage des résultats entre deux manches

// une fois que tous les joueurs ont répondu, délai laissé avant de basculer
// sur les résultats (plutôt que de couper la manche net) — mais seulement si
// il restait plus que ce délai au chrono naturel de la manche, sinon celui-ci
// suffit déjà (cf. submitAnswer, game.service.js)
export const ROUND_ANSWER_GRACE_MS = 3000

// startedAt (envoyé dans game:round:start) est fixé à Date.now() + ce délai
// plutôt qu'à l'instant présent : sans cette marge, chaque appareil lance la
// lecture de l'extrait dès que son propre buffer est prêt, ce qui varie selon
// la vitesse réseau de chacun et désynchronise le son perçu d'un joueur à
// l'autre. Ce délai laisse à tous les appareils le temps de charger l'extrait
// avant l'instant de lecture commun (cf. AudioPlayer.tsx côté client).
export const AUDIO_SYNC_LEAD_MS = 1000

export const TRACK_SUBMIT_TIMEOUT_MS = 15000 // délai laissé aux joueurs pour envoyer leurs titres likés avant de démarrer avec ceux déjà reçus

// délai laissé aux joueurs pour revenir au lobby (ou le quitter) après la fin
// d'une partie, avant de relancer : passé ce délai, les joueurs qui n'ont
// toujours pas donné signe de vie sont expulsés pour inactivité
export const RETURN_TO_LOBBY_TIMEOUT_MS = 30000

export const MIN_ROUNDS_PLAYABLE = 3 // en dessous, la partie ne peut pas démarrer même si le pool est trop petit

// équité inter-comptes en mode blindtest (cf. game.service.js,
// buildBlindtestRounds) : à chaque manche, priorité est donnée au joueur
// actif le moins représenté jusqu'ici parmi les titres qu'il est seul à
// avoir likés (tourniquet, cf. byFairness) — un titre liké par plusieurs
// joueurs actifs ne compte pour personne. Ce tourniquet tend naturellement
// vers une répartition égale (1/N des manches par joueur) tant que chacun a
// assez de titres exclusifs disponibles ; ce facteur est le vrai garde-fou,
// jamais dépassé : un joueur ne peut jamais recevoir plus de FACTOR × sa part
// "juste" (ex: 60% à 2 joueurs), même si son compte a beaucoup plus de
// titres likés qu'un autre (ex: 1800 vs 600, ~70/30 constaté sans ce
// plafond). En dessous, rien n'est garanti : si le pool exclusif d'un joueur
// est trop petit face à celui d'un autre (compte à moins de 100 titres likés
// contre un compte à plus de 1000), il n'y a pas assez de titres pour
// l'approcher, et l'algorithme prend alors tout ce qui est disponible plutôt
// que de laisser une manche vide.
export const FAIRNESS_MAX_SHARE_FACTOR = 1.2
