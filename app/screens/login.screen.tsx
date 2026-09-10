import React, { useState } from "react";
import { Text, View, Image } from "react-native";
import { getSpotifyUserProfile, loginWithSpotify } from "../modules/auth/spotify";
import { useAuthStore } from "../stores/auth.store";
import { useTrackStore } from "../stores/tracks.store";
import { spotifyService } from "../modules/spotify";
import { deezerService, extractDeezerProfileId } from "../modules/deezer";
import { CustomButton } from "../components/Button";
import { ScreenLayout } from "../components/ScreenLayout";
import { SectionTitle } from "../components/SectionTitle";
import { DeezerProfileModal } from "../components/auth/DeezerProfileModal";
import type { TrackType } from "../core/types";

type Provider = 'spotify' | 'deezer';

export const LoginScreen = () => {
    const setToken = useAuthStore((s) => s.setToken);
    const setAuthenticated = useAuthStore((s) => s.setAuthenticated);
    const { setLikedTracks, setTotalTracks } = useTrackStore.getState();
    const [loadingProvider, setLoadingProvider] = useState<Provider | null>(null);
    const [isDeezerModalVisible, setIsDeezerModalVisible] = useState(false);
    const [deezerModalError, setDeezerModalError] = useState<string | undefined>(undefined);

    // commun aux deux providers : pose le profil + les titres likés puis
    // bascule isAuthenticated en dernier (une fois les titres likés en place)
    // — c'est lui qui déclenche la navigation hors de cet écran (cf.
    // Navigator.tsx), et un joueur qui atteindrait le lobby avant que
    // useTrackStore.likedTracks soit rempli y soumettrait 0 titre
    // (submitMyTracks ne se relance jamais après coup)
    const finalizeLogin = (
        provider: Provider,
        userProfile: { display_name: string; id: string; email: string; img: string | null; account_type: string },
        tracks: TrackType[],
        total: number
    ) => {
        useAuthStore.getState().setUser({ ...userProfile, provider });
        setLikedTracks(tracks);
        setTotalTracks(total);
        setAuthenticated(true);
    };

    const handleSpotifyLogin = async () => {
        if (loadingProvider) return;
        setLoadingProvider('spotify');

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

            finalizeLogin(
                'spotify',
                {
                    display_name: userProfile.display_name,
                    id: userProfile.id,
                    email: userProfile.email,
                    img: userProfile.images?.[0]?.url || null,
                    account_type: userProfile.product,
                },
                tracks,
                total
            );

            console.log('✅ Connexion Spotify réussie');
        } catch (error) {
            console.error(error);
        } finally {
            setLoadingProvider(null);
        }
    };

    // La connexion OAuth Deezer (app/modules/auth/deezer.ts +
    // server/src/routes/auth.routes.js) est complète mais dormante : la
    // création d'app sur developers.deezer.com est cassée depuis ~2 ans, donc
    // impossible d'obtenir un app_id/secret pour l'instant. En attendant, on
    // utilise le lookup de profil public Deezer (sans authentification, cf.
    // deezerService.getPublicProfile / getPublicLikedTracks) : il suffit de
    // l'ID ou du lien du profil, à condition que l'utilisateur ait laissé ses
    // titres likés publics.
    const handleDeezerProfileLogin = async (profileInput: string) => {
        if (loadingProvider) return;
        setDeezerModalError(undefined);

        const userId = extractDeezerProfileId(profileInput);
        if (!userId) {
            setDeezerModalError('Lien ou ID de profil Deezer invalide');
            return;
        }

        setLoadingProvider('deezer');
        // pas de token pour ce mode : on s'assure qu'un éventuel token Spotify
        // d'une session précédente ne traîne pas dans le store
        setToken(null);

        try {
            const [userProfile, { tracks, total }] = await Promise.all([
                deezerService.getPublicProfile(userId),
                deezerService.getPublicLikedTracks(userId),
            ]);

            if (tracks.length === 0) {
                setDeezerModalError('Aucun titre liké trouvé — le profil est peut-être privé');
                return;
            }

            finalizeLogin(
                'deezer',
                {
                    display_name: userProfile.name,
                    id: String(userProfile.id),
                    email: '',
                    img: userProfile.picture_medium || userProfile.picture || null,
                    account_type: 'deezer',
                },
                tracks,
                total
            );

            setIsDeezerModalVisible(false);
            console.log('✅ Connexion Deezer (profil public) réussie');
        } catch (error) {
            console.error(error);
            setDeezerModalError(
                error instanceof Error ? error.message : 'Impossible de récupérer ce profil Deezer'
            );
        } finally {
            setLoadingProvider(null);
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
                        name={loadingProvider === 'spotify' ? "Connexion..." : "Spotify"}
                        iconFA="spotify"
                        onPress={handleSpotifyLogin}
                        variant="spotify"
                        available={!loadingProvider}
                        loading={loadingProvider === 'spotify'}
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
                        onPress={() => {
                            setDeezerModalError(undefined);
                            setIsDeezerModalVisible(true);
                        }}
                        variant="deezer"
                        available={!loadingProvider}
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
                        onPress={() => {}}
                        variant="dark"
                        available={false}
                    />

                    {/* déplacé ici (dans le même bloc que les boutons, avant
                    c'était un sibling du bloc entier) : posé en dehors, son
                    empilement dépendait d'un calcul flex fait par un parent
                    différent de celui des boutons, ce qui pouvait le faire
                    chevaucher le dernier bouton sur web au lieu de s'afficher
                    en dessous */}
                    <SectionTitle
                        subtitle="En te connectant, tu acceptes de partager tes titres likés pour jouer avec tes amis"
                        align="center"
                        size="xs"
                        className="mt-2"
                    />

                </View>
            </View>

            <DeezerProfileModal
                visible={isDeezerModalVisible}
                onClose={() => setIsDeezerModalVisible(false)}
                onConfirm={handleDeezerProfileLogin}
                error={deezerModalError}
                onInputChange={() => setDeezerModalError(undefined)}
                isSubmitting={loadingProvider === 'deezer'}
            />

        </ScreenLayout>
    );
};