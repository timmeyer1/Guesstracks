import React from "react";
import { View } from "react-native";
import {getSpotifyUserProfile, loginWithSpotify} from "../modules/auth/spotify";
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
            if (!data?.access_token) return;

            setToken(data.access_token);

            //recupere le profile utilisateur
            const userProfile = await getSpotifyUserProfile(data.access_token);
            useAuthStore.getState().setUser({
                display_name: userProfile.display_name,
                id: userProfile.id,
                email: userProfile.email,
                img: userProfile.images,
                account_type: userProfile.product,

            });

            const test = useAuthStore.getState().user;
            console.log('STORE66666666666666666666666666666666666666666',test)
            //recupere les chansons likés (limité a 50)
            const tracks = await spotifyService.getMyLikedTracks();
            setLikedTracks(tracks);

            //recupere le total des chansons likés
            const totalTracks = await spotifyService.getTotalTracks();
            setTotalTracks(totalTracks);


            console.log(userProfile)

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
                className="bg-spotify-primary"
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
