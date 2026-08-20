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

// mode blindtest : QCM de titres (le bon + des leurres)
export type GuessTrackOption = {
    id: string
    label: string
}

export type GameRoundOption = WhoLikedOption | GuessTrackOption

export const isGuessTrackOption = (option: GameRoundOption): option is GuessTrackOption =>
    'label' in option

export const isWhoLikedOption = (option: GameRoundOption): option is WhoLikedOption =>
    'name' in option

export type GameRoundTrack = {
    id: string
    // absents tant que questionType === 'guess_track' et que la manche est en cours
    // (ce sont justement les infos à deviner)
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
    options: GameRoundOption[]
    duration: number
    startedAt: number
    track: GameRoundTrack
}

export type GameRoundPlayerResult = {
    playerId: string
    selectedIds: string[]
    answered: boolean
    elapsedMs: number | null
    correctSelected: number
    incorrectSelected: number
    isPerfect: boolean
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
}

export type GameEnd = {
    leaderboard: FinalLeaderboardEntry[]
    totalRounds: number
}

export type GamePhase = 'idle' | 'collecting' | 'in_round' | 'round_result' | 'finished'
