import { View, Text, Pressable } from 'react-native';
import { loginWithSpotify } from '../modules/auth/spotify';
import { useAuthStore } from '../stores/auth.store';
import {TrackStore} from "../stores/tracks.store";
import {spotifyService} from "../modules/spotify";

export const LoginScreen = () => {
    const setToken = useAuthStore((s) => s.setToken);

    const {setLikedTracks} = TrackStore.getState()

    const handleLogin = async () => {
        try{
            const data = await loginWithSpotify();
            if (data?.access_token) setToken(data.access_token);

            const tracks = await spotifyService.getMyLikedTracksSimplified();
            setLikedTracks(tracks);
            console.log(tracks);
        }catch (error) {
            throw error;
        }

    };

    return (
        <View className="flex-1 bg-white items-center justify-center">
            <Pressable
                onPress={handleLogin}
                className="bg-green-500 px-8 py-4 rounded-full"
            >
                <Text className="text-white font-bold text-lg">spotify</Text>
            </Pressable>
        </View>
    );
};