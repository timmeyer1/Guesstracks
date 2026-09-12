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

// recherche dans le catalogue Deezer pour la connexion universelle (choix
// manuel des titres, cf. ../../screens/manualTrackPicker.screen.tsx), groupée
// par album (chaque album renvoyé porte sa tracklist complète, dans l'ordre
// officiel — pas seulement les titres qui ont matché la requête, cf.
// server/src/services/deezer.service.js/searchTracksGroupedByAlbum) — proxyée
// par notre propre serveur (cf. server/src/routes/auth.routes.js) plutôt
// qu'appelée directement depuis le client : l'API Deezer ne renvoie aucun
// header CORS, un appel direct échoue systématiquement sur web (constaté en
// pratique — contrairement au lookup de profil public de
// ../deezer/deezer.api.ts, qui lui n'est utilisé qu'en natif et n'a donc
// jamais révélé ce problème)
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
