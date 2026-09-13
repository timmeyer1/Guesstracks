import { lobbyApiClient, extractLobbyErrorMessage } from '../../core/api/lobby.client';
import type { TrackType } from '../../core/types';

export type AlbumSearchResult = {
    id: string;
    title: string;
    artist: string;
    cover: string | null;
    tracks: TrackType[];
};

export type SimilarArtist = {
    id: string;
    name: string;
    picture: string | null;
};

export type SearchTracksResult = {
    albums: AlbumSearchResult[];
    similarArtists: SimilarArtist[];
};

type SearchTracksResponse = {
    albums: {
        id: string;
        title: string;
        artist: string;
        cover: string | null;
        tracks: {
            id: string;
            name: string;
            artist: string;
            album: string;
            image: string | null;
            previewUrl: string | null;
        }[];
    }[];
    similarArtists: SimilarArtist[];
};

// recherche dans le catalogue Deezer pour le choix manuel de titres, groupée
// par album avec la tracklist complète. Ça passe par notre serveur et pas
// direct l'API Deezer, en gros Deezer renvoie aucun header CORS et ça plante sur web.
export const searchDeezerAlbums = async (query: string): Promise<SearchTracksResult> => {
    try {
        const { data } = await lobbyApiClient.get<SearchTracksResponse>('/auth/search-tracks', {
            params: { q: query },
        });
        return {
            albums: data.albums.map((album) => ({
                id: album.id,
                title: album.title,
                artist: album.artist,
                cover: album.cover,
                tracks: album.tracks.map((track) => ({
                    id: track.id,
                    name: track.name,
                    artist: track.artist,
                    album: track.album,
                    image: track.image ?? undefined,
                    previewUrl: track.previewUrl,
                    provider: 'deezer',
                })),
            })),
            similarArtists: data.similarArtists ?? [],
        };
    } catch (error) {
        throw new Error(extractLobbyErrorMessage(error));
    }
};
