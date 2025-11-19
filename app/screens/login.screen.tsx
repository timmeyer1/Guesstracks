import React from "react";
import { Text, View, Image } from "react-native";
import { getSpotifyUserProfile, loginWithSpotify } from "../modules/auth/spotify";
import { useAuthStore } from "../stores/auth.store";
import { TrackStore } from "../stores/tracks.store";
import { spotifyService } from "../modules/spotify";
import { CustomButton } from "../components/Button";
import { ScreenLayout } from "../components/ScreenLayout";

export const LoginScreen = () => {
    const setToken = useAuthStore((s) => s.setToken);
    const { setLikedTracks, setTotalTracks } = TrackStore.getState();

    const handleLogin = async () => {
        try {
            const data = await loginWithSpotify();
            if (!data?.access_token) return;

            setToken(data.access_token);

            const userProfile = await getSpotifyUserProfile(data.access_token);
            const imageUrl = userProfile.images?.[0]?.url || null;

            useAuthStore.getState().setUser({
                display_name: userProfile.display_name,
                id: userProfile.id,
                email: userProfile.email,
                img: imageUrl,
                account_type: userProfile.product,
            });

            const tracks = await spotifyService.getMyLikedTracks();
            setLikedTracks(tracks);

            const totalTracks = await spotifyService.getTotalTracks();
            setTotalTracks(totalTracks);

            console.log('✅ Connexion réussie');
        } catch (error) {
            console.error(error);
        }
    };

    return (
        <ScreenLayout>
            <View className="flex-1 justify-center items-center w-full">
                <View className="mb-8">
                    <Image
                        source={require('../images/logo.png')}
                        style={{ width: 120, height: 120 }}
                    />
                </View>

                <Text className="text-3xl font-bold text-white mb-4">
                    GuessTracks
                </Text>

                <Text className="text-lg text-gray-400 mb-12">
                    Devine les musiques likées !
                </Text>

                <Text className="text-base text-gray-500 text-center px-6 mb-12">
                    Connecte-toi avec ton service de musique préféré pour jouer avec tes amis.
                </Text>

                <View className="w-full gap-4">
                    <CustomButton
                        name="Spotify"
                        icon="spotify"
                        onPress={handleLogin}
                        className="bg-spotify-primary"
                    />

                    <CustomButton
                        name="Deezer"
                        icon="deezer"
                        onPress={() => console.log("Deezer")}
                        className="bg-deezer-primary"
                        available={false}
                    />

                    <CustomButton
                        name="Apple Music"
                        icon="apple"
                        onPress={() => console.log("Apple Music")}
                        className="bg-apple-primary"
                        available={false}
                    />
                </View>
            </View>

            <Text className="text-sm text-gray-600 text-center px-8">
                En te connectant, tu acceptes de partager tes titres likés pour jouer avec tes amis
            </Text>
        </ScreenLayout>
    );
};