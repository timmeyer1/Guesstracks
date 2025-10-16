export type TrackType = {
    id: string;
    name: string;
    artist: string;
    album: string;
    image?: string;
    provider: 'spotify' | 'deezer' | 'applemusic';
};

export type LobbyType = {
    token: string
    name: string
    nb_player: number
    max_player: number
}


export type LobbyUserType = {
    token: string
    name: string
    img?: string
    account_type?: string
}