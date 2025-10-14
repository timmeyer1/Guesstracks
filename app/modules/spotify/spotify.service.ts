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

        return data.items.map((item:any) => {
            const track = item.track;
            return {
                id: track.id,
                name: track.name,
                artist: track.artists[0]?.name ?? 'Unknown',
                album: track.album.name,
                image: track.album.images[0]?.url,
                explicit: track.explicit,
                popularity: track.popularity,
                uri: track.uri,
            };
        });
    },

};
