export type TrackType = {
    id: string;
    name: string;
    artist: string;
    album: string;
    image?: string;
    previewUrl?: string | null;
    provider: 'spotify' | 'deezer' | 'applemusic' | 'csv';
};


export type GameMode = 'who_liked' | 'blindtest'
// durée d'une phase de manche, en secondes
export type PhaseSpeed = number

export type LobbyType = {
    code: string;
    name: string;
    nb_player: number;
    max_player: number;
    gameMode: GameMode;
    rounds: number;
    phaseSpeed: PhaseSpeed;
    // si activé, ça n'enchaîne plus tout seul après les résultats : c'est
    // l'hôte qui doit lancer la manche suivante
    manualAdvance: boolean;
    settingsConfirmed: boolean;
};


export type LobbyUserType = {
    id: string
    name: string
    img?: string
    account_type?: string
}

// ---- Jeu ----

export type QuestionType = 'who_liked' | 'guess_track'

// mode who_liked (Who Liked It) : on choisit parmi les joueurs du lobby
export type WhoLikedOption = {
    id: string
    name: string
    img: string | null
}

// mode blindtest : y'a un seul titre à trouver, en tapant dans le catalogue
// (voir CatalogEntry), pas de liste d'options comme en who_liked
export type GameRoundTrack = {
    id: string
    // Absents pendant une manche guess_track, dcp c'est ça qu'il faut deviner. L'image reste, mais floutée côté client.
    name?: string
    artist?: string
    album?: string
    image?: string | null
    previewUrl?: string | null
}

export type GameRoundStart = {
    roundIndex: number
    totalRounds: number
    questionType: QuestionType
    options: WhoLikedOption[] // vide en mode blindtest
    duration: number
    startedAt: number
    track: GameRoundTrack
}

// catalogue de recherche du blindtest : tous les titres likés par le lobby,
// envoyé une seule fois quand la partie démarre
export type CatalogEntry = {
    id: string
    name: string
    artist: string
    image?: string | null
}

export type GameRoundPlayerResult = {
    playerId: string
    selectedIds: string[]
    answered: boolean
    elapsedMs: number | null
    correctSelected: number
    incorrectSelected: number
    isPerfect: boolean
    // Facteur de vitesse (0..1), déjà compté dans basePoints. Gardé à part juste pour afficher "vitesse : xx %".
    speedFactor: number
    basePoints: number
    // Détail du bonusPoints : bonus de série et bonus "manche parfaite", séparés.
    streakBonus: number
    perfectBonus: number
    bonusPoints: number
    points: number
    totalPoints: number
    streak: number
}

export type LeaderboardEntry = {
    playerId: string
    name: string
    img: string | null
    total: number
    streak: number
    bestStreak: number
    correctRounds: number
    perfectRounds: number
}

export type FinalLeaderboardEntry = LeaderboardEntry & {
    accuracy: number
    fastestMs: number | null
}

export type GameRoundEnd = {
    roundIndex: number
    correctAnswerIds: string[]
    track: { id: string; name: string; artist: string; album: string; image: string | null }
    results: GameRoundPlayerResult[]
    leaderboard: LeaderboardEntry[]
    // Même principe que startedAt : une heure commune pour relancer l'extrait sur l'écran de résultat, en sync pour tout le monde.
    audioStartedAt: number
}

export type GameStarted = {
    totalRounds: number
    gameMode: GameMode
    // cf. LobbyType.manualAdvance : figé pour toute la partie au lancement
    manualAdvance: boolean
    catalog?: CatalogEntry[] // présent uniquement en mode blindtest
}

export type GameEnd = {
    leaderboard: FinalLeaderboardEntry[]
    totalRounds: number
    // même principe que dans GameRoundEnd, pour l'extrait rejoué sur l'écran
    // des résultats finaux
    audioStartedAt: number
}

export type GamePhase = 'idle' | 'collecting' | 'in_round' | 'round_result' | 'finished'
