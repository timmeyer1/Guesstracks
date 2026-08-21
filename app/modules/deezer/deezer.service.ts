import {deezerApi} from "./deezer.api";
import type {TrackType} from "../../core/types";
import type {AxiosResponse} from "axios";

const PAGE_SIZE = 100;
// borne le nombre de titres récupérés pour garder un temps de chargement
// raisonnable tout en donnant assez de variété pour une partie (max 20 manches)
const MAX_TRACKS = 300;

const deezerError = (data: any) =>
    data?.error ? new Error(data.error.message || 'Erreur Deezer') : null;

const mapItem = (item: any): TrackType => ({
    id: String(item.id),
    name: item.title,
    artist: item.artist?.name ?? 'Unknown',
    album: item.album?.title ?? '',
    image: item.album?.cover_medium ?? item.album?.cover ?? undefined,
    // Deezer fournit un extrait de 30s pour la quasi-totalité de son
    // catalogue (contrairement à Spotify qui les a retirés fin 2024) : le
    // repli iTunes côté serveur (cf. server/src/services/preview.service.js)
    // n'est donc quasiment jamais nécessaire pour les titres de ce provider
    previewUrl: item.preview || null,
    provider: 'deezer',
});

// commun aux deux modes de récupération (OAuth "me" ou lookup public par id,
// cf. plus bas) : le premier appel renseigne `total`, les pages restantes
// sont récupérées en parallèle plutôt qu'en séquence pour diviser le temps
// de chargement par ~le nombre de pages
const collectLikedTracks = async (
    fetchPage: (limit: number, index: number) => Promise<AxiosResponse<any>>
): Promise<{ tracks: TrackType[]; total: number }> => {
    const first = await fetchPage(PAGE_SIZE, 0);
    const firstError = deezerError(first.data);
    if (firstError) throw firstError;

    const total = first.data.total ?? 0;
    const tracks: TrackType[] = (first.data.data ?? []).map(mapItem);

    const remainingIndexes: number[] = [];
    for (let index = PAGE_SIZE; index < Math.min(total, MAX_TRACKS); index += PAGE_SIZE) {
        remainingIndexes.push(index);
    }

    const pages = await Promise.all(remainingIndexes.map((index) => fetchPage(PAGE_SIZE, index)));
    for (const { data } of pages) {
        if (deezerError(data)) continue;
        tracks.push(...(data.data ?? []).map(mapItem));
    }

    return { tracks, total };
};

export const deezerService = {

    // -- connexion OAuth ("me", cf. app/modules/auth/deezer.ts) --

    async getMyProfile() {
        const { data } = await deezerApi.getUserProfile();
        const error = deezerError(data);
        if (error) throw error;
        return data;
    },

    async getMyLikedTracks(): Promise<{ tracks: TrackType[]; total: number }> {
        return collectLikedTracks((limit, index) => deezerApi.getUserFavoriteTracks(limit, index));
    },

    async getTotalTracks() {
        const { data } = await deezerApi.getUserFavoriteTracks(1, 0);
        const error = deezerError(data);
        if (error) throw error;
        return data.total ?? 0;
    },

    // -- lookup de profil public, sans authentification (chemin actif tant
    // que la création d'app OAuth Deezer est indisponible, cf.
    // app/modules/deezer/deezer.utils.ts) --

    async getPublicProfile(userId: string) {
        const { data } = await deezerApi.getPublicProfile(userId);
        const error = deezerError(data);
        if (error) throw error;
        return data;
    },

    async getPublicLikedTracks(userId: string): Promise<{ tracks: TrackType[]; total: number }> {
        return collectLikedTracks((limit, index) => deezerApi.getPublicFavoriteTracks(userId, limit, index));
    },

    async getPublicTotalTracks(userId: string) {
        const { data } = await deezerApi.getPublicFavoriteTracks(userId, 1, 0);
        const error = deezerError(data);
        if (error) throw error;
        return data.total ?? 0;
    },

};
