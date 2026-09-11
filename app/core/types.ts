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
    // si activé, la partie n'enchaîne plus automatiquement sur la manche
    // suivante après l'affichage des résultats : seul l'hôte peut continuer
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
    // facteur de vitesse (0..1) déjà appliqué dans basePoints — exposé à part
    // pour pouvoir afficher "vitesse : xx %" sans reconstituer le calcul
    speedFactor: number
    basePoints: number
    // détail de bonusPoints (leur somme) : série de manches parfaites
    // d'affilée vs. bonus fixe "manche parfaite"
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
    // même principe que GameRoundStart.startedAt : instant commun (epoch,
    // cf. server/src/constants.js AUDIO_SYNC_LEAD_MS) auquel rejouer l'extrait
    // sur l'écran de résultat de manche, pour que tous les appareils
    // l'entendent reprendre en même temps
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
    // même principe que GameRoundEnd.audioStartedAt, pour l'extrait rejoué
    // sur l'écran de résultats finaux
    audioStartedAt: number
}

export type GamePhase = 'idle' | 'collecting' | 'in_round' | 'round_result' | 'finished'
