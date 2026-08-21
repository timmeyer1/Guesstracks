export type TrackType = {
    id: string;
    name: string;
    artist: string;
    album: string;
    image?: string;
    previewUrl?: string | null;
    provider: 'spotify' | 'deezer' | 'applemusic';
};


export type GameMode = 'guesstracks' | 'blindtest'
export type PhaseSpeed = 'slow' | 'normal' | 'fast'

export type LobbyType = {
    code: string;
    name: string;
    nb_player: number;
    max_player: number;
    gameMode: GameMode;
    rounds: number;
    phaseSpeed: PhaseSpeed;
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

// mode guesstracks : on choisit parmi les joueurs du lobby
export type WhoLikedOption = {
    id: string
    name: string
    img: string | null
}

// mode blindtest : un seul titre "à trouver" par recherche dans le catalogue
// (cf. CatalogEntry), donc pas d'options à choix multiple ici
export type GameRoundTrack = {
    id: string
    // absents tant que questionType === 'guess_track' et que la manche est en cours
    // (ce sont justement les infos à deviner) ; l'image reste présente mais
    // doit être affichée floutée par le client
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

// catalogue de recherche du mode blindtest : tous les titres likés par le
// lobby, envoyé une seule fois au lancement de la partie
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
    basePoints: number
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
}

export type GameStarted = {
    totalRounds: number
    gameMode: GameMode
    catalog?: CatalogEntry[] // présent uniquement en mode blindtest
}

export type GameEnd = {
    leaderboard: FinalLeaderboardEntry[]
    totalRounds: number
}

export type GamePhase = 'idle' | 'collecting' | 'in_round' | 'round_result' | 'finished'
