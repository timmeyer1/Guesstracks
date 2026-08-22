import {spotifyApi} from "./spotify.api";
import type {SpotifyLikedTrackItem} from "./spotify.api";
import type {TrackType} from "../../core/types";

const PAGE_SIZE = 50;
// nombre de pages récupérées en parallèle : toutes les récupérer d'un coup
// pour une grosse bibliothèque (plusieurs centaines/milliers de titres)
// dépasse la limite de débit de l'API Spotify et fait échouer toute la
// connexion — par lots, ça reste rapide sans jamais rien tronquer
const FETCH_BATCH_SIZE = 5;

// Spotify renvoie tous les artistes d'un titre (principal + featurings) dans
// `artists` : ne garder que artists[0] faisait disparaître les artistes en
// feat., introuvables ensuite dans la recherche du blindtest (cf.
// SearchTrackQuestion.tsx, qui cherche aussi sur ce champ `artist`)
const formatArtists = (artists: { name?: string }[] | undefined): string => {
    const names = (artists ?? []).map((a) => a?.name).filter((name): name is string => Boolean(name));
    if (names.length === 0) return 'Unknown';
    if (names.length === 1) return names[0];
    return `${names[0]} feat. ${names.slice(1).join(', ')}`;
};

const mapItem = (item: SpotifyLikedTrackItem): TrackType => ({
    id: item.track.id,
    name: item.track.name,
    artist: formatArtists(item.track.artists),
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
    // à l'appelant un aller-retour getTotalTracks() séparé après coup.
    // Récupère TOUS les titres likés, sans plafond : un plafond ici privait
    // silencieusement les grosses bibliothèques d'une partie de leurs titres,
    // ce qui rendait les mêmes musiques disponibles à chaque partie.
    async getMyLikedTracks(): Promise<{ tracks: TrackType[]; total: number }> {
        const first = await spotifyApi.getUserLikedTracks(PAGE_SIZE, 0);
        const total = first.data.total ?? 0;
        const tracks: TrackType[] = (first.data.items ?? []).map(mapItem);

        const remainingOffsets: number[] = [];
        for (let offset = PAGE_SIZE; offset < total; offset += PAGE_SIZE) {
            remainingOffsets.push(offset);
        }

        // par lots plutôt que tout en parallèle d'un coup (cf. FETCH_BATCH_SIZE)
        for (let i = 0; i < remainingOffsets.length; i += FETCH_BATCH_SIZE) {
            const batch = remainingOffsets.slice(i, i + FETCH_BATCH_SIZE);
            const pages = await Promise.all(batch.map((offset) => spotifyApi.getUserLikedTracks(PAGE_SIZE, offset)));
            for (const { data } of pages) {
                tracks.push(...(data.items ?? []).map(mapItem));
            }
        }

        return { tracks, total };
    },

    async getTotalTracks() {
        const { data } = await spotifyApi.getUserLikedTracks(1, 0);
        return data.total ?? 0;
    }

};
