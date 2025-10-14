export type TrackType = {
    id: string;
    name: string;
    artist: string;
    album: string;
    image?: string;
    provider: 'spotify' | 'deezer' | 'applemusic';
};
