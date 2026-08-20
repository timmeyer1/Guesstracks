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

    async getMyLikedTracks(): Promise<TrackType[]> {
        const tracks: TrackType[] = [];
        let offset = 0;

        while (offset < MAX_TRACKS) {
            const { data } = await spotifyApi.getUserLikedTracks(PAGE_SIZE, offset);
            const items = data.items ?? [];
            tracks.push(...items.map(mapItem));

            if (!data.next || items.length < PAGE_SIZE) break;
            offset += PAGE_SIZE;
        }

        return tracks;
    },

    async getTotalTracks() {
        const { data } = await spotifyApi.getUserLikedTracks(1, 0);
        return data.total;
    }

};
