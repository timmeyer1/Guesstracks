import {apiClient} from "../../core/api/client";
import {SPOTIFY_BASE_URL} from "../../core/constants";


export const spotifyApi = {

    // TODO a voir si c'est utile plus tard
/*    //partie données
    fetchAllFromCategory: (category: string) =>
        apiClient.get(`${SPOTIFY_BASE_URL}/${category}`),

    fetchOneByCategory: (category: string, id?:string) =>
        apiClient.get(`${SPOTIFY_BASE_URL}/${category}/${id}`),*/



    //partie utilisateur
    getUserProfile: () =>
        apiClient.get(`${SPOTIFY_BASE_URL}/me`),

    getUserLikedTracks: (limit = 50, offset = 0) =>
        apiClient.get(`${SPOTIFY_BASE_URL}/me/tracks`,{
            params:{
                limit,
                offset,
            }
        }),
};
