import React from "react";
import { View } from "react-native";
import { loginWithSpotify } from "../modules/auth/spotify";
import { useAuthStore } from "../stores/auth.store";
import { TrackStore } from "../stores/tracks.store";
import { spotifyService } from "../modules/spotify";
import {CustomButton} from "../components/Button";

export const LoginScreen = () => {
    const setToken = useAuthStore((s) => s.setToken);
    const { setLikedTracks, setTotalTracks } = TrackStore.getState();

    const handleLogin = async () => {
        try {
            const data = await loginWithSpotify();
            if (data?.access_token) setToken(data.access_token);

            const tracks = await spotifyService.getMyLikedTracks();
            setLikedTracks(tracks);

            const totalTracks = await spotifyService.getTotalTracks();
            setTotalTracks(totalTracks);
        } catch (error) {
            console.error(error);
        }
    };

    return (
        <View className="flex-1 bg-spotify-lightdark items-center justify-center w-full px-6">
            <CustomButton
                name="Spotify"
                icon="spotify"
                onPress={handleLogin}
                className="bg-spotify-primary "
            />
            <CustomButton
                name="Apple Music"
                icon="apple"
                onPress={() => console.log("Apple Music")}
                className="bg-apple-primary"
                available={false}
            />
            <CustomButton
                name="Deezer"
                icon="deezer"
                onPress={() => console.log("Deezer")}
                className="bg-deezer-primary"
                available={false}
            />
        </View>
    );
};
