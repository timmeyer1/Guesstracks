import {apiClient} from "../../core/api/client";
import {SPOTIFY_BASE_URL} from "../../core/constants";

export type SpotifyUserProfile = {
    display_name: string
    id: string
    email: string
    images?: { url: string }[]
    product: string
}

// item de GET /me/tracks : `track.artists` contient l'artiste principal ET
// les featurings (cf. formatArtists dans spotify.service.ts)
export type SpotifyLikedTrackItem = {
    track: {
        id: string
        name: string
        artists?: { name?: string }[]
        album: { name: string; images: { url: string }[] }
        preview_url: string | null
    }
}

export type SpotifyLikedTracksResponse = {
    items?: SpotifyLikedTrackItem[]
    total?: number
}

export const spotifyApi = {

    // TODO a voir si c'est utile plus tard
/*    //partie données
    fetchAllFromCategory: (category: string) =>
        apiClient.get(`${SPOTIFY_BASE_URL}/${category}`),

    fetchOneByCategory: (category: string, id?:string) =>
        apiClient.get(`${SPOTIFY_BASE_URL}/${category}/${id}`),*/



    //partie utilisateur
    getUserProfile: () =>
        apiClient.get<SpotifyUserProfile>(`${SPOTIFY_BASE_URL}/me`),

    getUserLikedTracks: (limit = 50, offset = 0) =>
        apiClient.get<SpotifyLikedTracksResponse>(`${SPOTIFY_BASE_URL}/me/tracks`,{
            params:{
                limit,
                offset,
            }
        }),
};
