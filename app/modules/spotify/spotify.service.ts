import {spotifyApi} from "./spotify.api";

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

    async getMyLikedTracks() {
        const { data } = await spotifyApi.getUserLikedTracks();
        return data.items.map((item:any) => ({
            id: item.track.id,
            name: item.track.name,
            artist: item.track.artists[0]?.name ?? 'Unknown',
            album: item.track.album.name,
            image: item.track.album.images[0]?.url,
            provider: 'spotify',
        }));
    },

};
