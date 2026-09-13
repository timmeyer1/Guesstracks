import {deezerApi} from "./deezer.api";
import type {DeezerErrorPayload, DeezerTrackItem, DeezerTracksResponse} from "./deezer.api";
import type {TrackType} from "../../core/types";
import type {AxiosResponse} from "axios";

const PAGE_SIZE = 100;
// nombre de pages chargées en même temps. Tout charger d'un coup pour une
// grosse bibliothèque ça fait dépasser la limite de l'API Deezer, dcp on y va par lots
const FETCH_BATCH_SIZE = 5;

const deezerError = (data: DeezerErrorPayload | undefined) =>
    data?.error ? new Error(data.error.message || 'Erreur Deezer') : null;

const mapItem = (item: DeezerTrackItem): TrackType => ({
    id: String(item.id),
    name: item.title,
    artist: item.artist?.name ?? 'Unknown',
    album: item.album?.title ?? '',
    image: item.album?.cover_medium ?? item.album?.cover ?? undefined,
    // Deezer donne quasi toujours un extrait de 30s (contrairement à Spotify
    // qui a retiré ça), donc en gros le repli iTunes côté serveur sert presque jamais ici
    previewUrl: item.preview || null,
    provider: 'deezer',
});

// sert pour les deux façons de récupérer les titres (connecté ou profil
// public) : le premier appel donne le total, le reste est chargé par lots
// pour pas se faire limiter par Deezer. Tout est récupéré, y'a pas de plafond.
const collectLikedTracks = async (
    fetchPage: (limit: number, index: number) => Promise<AxiosResponse<DeezerTracksResponse>>
): Promise<{ tracks: TrackType[]; total: number }> => {
    const first = await fetchPage(PAGE_SIZE, 0);
    const firstError = deezerError(first.data);
    if (firstError) throw firstError;

    const total = first.data.total ?? 0;
    const tracks: TrackType[] = (first.data.data ?? []).map(mapItem);

    const remainingIndexes: number[] = [];
    for (let index = PAGE_SIZE; index < total; index += PAGE_SIZE) {
        remainingIndexes.push(index);
    }

    for (let i = 0; i < remainingIndexes.length; i += FETCH_BATCH_SIZE) {
        const batch = remainingIndexes.slice(i, i + FETCH_BATCH_SIZE);
        const pages = await Promise.all(batch.map((index) => fetchPage(PAGE_SIZE, index)));
        for (const { data } of pages) {
            if (deezerError(data)) continue;
            tracks.push(...(data.data ?? []).map(mapItem));
        }
    }

    return { tracks, total };
};

export const deezerService = {

    // -- pour un compte connecté --

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

    // -- pour un profil public, sans connexion (le chemin utilisé en vrai
    // pour l'instant) --

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
