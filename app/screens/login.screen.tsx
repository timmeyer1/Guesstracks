import React, { useState } from "react";
import { Text, View, Image } from "react-native";
import { getSpotifyUserProfile, loginWithSpotify } from "../modules/auth/spotify";
import { useAuthStore } from "../stores/auth.store";
import { TrackStore } from "../stores/tracks.store";
import { spotifyService } from "../modules/spotify";
import { CustomButton } from "../components/Button";
import { ScreenLayout } from "../components/ScreenLayout";
import { SectionTitle } from "../components/SectionTitle";

export const LoginScreen = () => {
    const setToken = useAuthStore((s) => s.setToken);
    const setAuthenticated = useAuthStore((s) => s.setAuthenticated);
    const { setLikedTracks, setTotalTracks } = TrackStore.getState();
    const [isLoggingIn, setIsLoggingIn] = useState(false);

    const handleLogin = async () => {
        if (isLoggingIn) return;
        setIsLoggingIn(true);

        try {
            const data = await loginWithSpotify();
            if (!data?.access_token) return;

            // posé tout de suite : apiClient (getSpotifyUserProfile via fetch direct,
            // mais aussi getMyLikedTracks juste après) lit le token depuis ce store
            setToken(data.access_token);

            // le profil et les titres likés sont indépendants l'un de l'autre :
            // on les récupère en parallèle plutôt qu'en séquence pour réduire
            // le temps de connexion perçu
            const [userProfile, { tracks, total }] = await Promise.all([
                getSpotifyUserProfile(data.access_token),
                spotifyService.getMyLikedTracks(),
            ]);
            const imageUrl = userProfile.images?.[0]?.url || null;

            useAuthStore.getState().setUser({
                display_name: userProfile.display_name,
                id: userProfile.id,
                email: userProfile.email,
                img: imageUrl,
                account_type: userProfile.product,
            });

            setLikedTracks(tracks);
            setTotalTracks(total);

            // isAuthenticated ne bascule qu'ici (une fois les titres likés en
            // place) : c'est lui qui déclenche la navigation hors de cet écran
            // (cf. Navigator.tsx), et un joueur qui atteindrait le lobby avant
            // que TrackStore.likedTracks soit rempli y soumettrait 0 titre
            // (submitMyTracks ne se relance jamais après coup)
            setAuthenticated(true);

            console.log('✅ Connexion réussie');
        } catch (error) {
            console.error(error);
        } finally {
            setIsLoggingIn(false);
        }
    };

    return (
        <ScreenLayout>
            <View className="flex-1 justify-center items-center w-full">
                <Image
                    source={require('../images/logo.png')}
                    style={{ width: 150, height: 150 }}
                />
                <View className="w-full gap-4">

                    <SectionTitle
                        title="Guesstracks"
                        subtitle="Connecte-toi avec ton service de musique préféré pour jouer avec tes amis."
                        align="center"
                        size="xl"
                        className="py-4"
                    />

                    <CustomButton
                        name={isLoggingIn ? "Connexion..." : "Spotify"}
                        iconFA="spotify"
                        onPress={handleLogin}
                        variant="spotify"
                        available={!isLoggingIn}
                        loading={isLoggingIn}
                    />

                    <CustomButton
                        name="Apple Music"
                        iconFA="apple"
                        onPress={() => console.log("Apple Music")}
                        variant="apple_music"
                        available={false}
                    />

                    <CustomButton
                        name="Deezer"
                        iconFA="deezer"
                        onPress={() => console.log("Deezer")}
                        variant="deezer"
                        available={false}
                    />

                    <CustomButton
                        name="Youtube Music"
                        iconFA="youtube"
                        onPress={() => console.log("Youtube Music")}
                        variant="youtube_music"
                        available={false}
                    />

                    <SectionTitle
                        title="ou"
                        align="center"
                        size="sm"
                    />

                    <CustomButton
                        name="Se connecter en tant qu'invité"
                        onPress={() => console.log("Youtube Music")}
                        variant="dark"
                        available={true}
                    />

                </View>
            </View>

            <SectionTitle
                subtitle="En te connectant, tu acceptes de partager tes titres likés pour jouer avec tes amis"
                align="center"
                size="xs"
            />

        </ScreenLayout>
    );
};