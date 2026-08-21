import {spotifyApi} from "./spotify.api";
import type {TrackType} from "../../core/types";

const PAGE_SIZE = 50;
// borne le nombre de titres récupérés pour garder un temps de chargement
// raisonnable tout en donnant assez de variété pour une partie (max 20 manches)
const MAX_TRACKS = 300;

const mapItem = (item: any): TrackType => ({
    id: item.track.id,
    name: item.track.name,
    artist: item.track.artists[0]?.name ?? 'Unknown',
    album: item.track.album.name,
    image: item.track.album.images[0]?.url,
    previewUrl: item.track.preview_url ?? null,
    provider: 'spotify',
});

export const spotifyService = {

/*    async getAllByCategory(category: string) {
        const { data } = await spotifyApi.fetchAllFromCategory(category);
        return data;
    },

    async getOneByCategory(category: string,id?:string) {
        const { data } = await spotifyApi.fetchOneByCategory(category, id);
        return data
    },*/


    async getMyProfile() {
        try{
            const { data } = await spotifyApi.getUserProfile()
            return data;
        }catch(error){
            throw error;
        }
    },

    // renvoie aussi `total` (déjà présent dans la réponse Spotify) pour éviter
    // à l'appelant un aller-retour getTotalTracks() séparé après coup
    async getMyLikedTracks(): Promise<{ tracks: TrackType[]; total: number }> {
        const first = await spotifyApi.getUserLikedTracks(PAGE_SIZE, 0);
        const total = first.data.total ?? 0;
        const tracks: TrackType[] = (first.data.items ?? []).map(mapItem);

        // le premier appel renseigne le nombre total de pages restantes : on les
        // récupère toutes en parallèle plutôt qu'en attendant chaque page l'une
        // après l'autre, ce qui divise le temps de chargement par ~le nombre de pages
        const remainingOffsets: number[] = [];
        for (let offset = PAGE_SIZE; offset < Math.min(total, MAX_TRACKS); offset += PAGE_SIZE) {
            remainingOffsets.push(offset);
        }

        const pages = await Promise.all(
            remainingOffsets.map((offset) => spotifyApi.getUserLikedTracks(PAGE_SIZE, offset))
        );
        for (const { data } of pages) {
            tracks.push(...(data.items ?? []).map(mapItem));
        }

        return { tracks, total };
    },

    async getTotalTracks() {
        const { data } = await spotifyApi.getUserLikedTracks(1, 0);
        return data.total;
    }

};
