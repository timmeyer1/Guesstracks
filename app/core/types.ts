export type TrackType = {
    id: string;
    name: string;
    artist: string;
    album: string;
    image?: string;
    provider: 'spotify' | 'deezer' | 'applemusic';
};


export type GameMode = 'guesstracks' | 'blindtest'
export type PhaseSpeed = 'slow' | 'normal' | 'fast'

export type LobbyType = {
    token: string;
    name: string;
    nb_player: number;
    max_player: number;
    gameMode: GameMode;
    rounds: number;
    phaseSpeed: PhaseSpeed;
};


export type LobbyUserType = {
    token: string
    name: string
    img?: string
    account_type?: string
}