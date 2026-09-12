import React, { useEffect, useState } from "react";
import { Text, View, Image } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { getSpotifyUserProfile, loginWithSpotify } from "../modules/auth/spotify";
import { importTracksFromCsv, type CsvImportResult } from "../modules/auth/csv";
import { useAuthStore } from "../stores/auth.store";
import { useTrackStore } from "../stores/tracks.store";
import { useManualTrackPickerStore } from "../stores/manualTrackPicker.store";
import { spotifyService } from "../modules/spotify";
import { deezerService, extractDeezerProfileId } from "../modules/deezer";
import { CustomButton } from "../components/Button";
import { IconButton } from "../components/IconButton";
import { ScreenLayout } from "../components/ScreenLayout";
import { SectionTitle } from "../components/SectionTitle";
import { DeezerProfileModal } from "../components/auth/DeezerProfileModal";
import { CsvProfileModal } from "../components/auth/CsvProfileModal";
import { UniversalLoginChoiceModal } from "../components/auth/UniversalLoginChoiceModal";
import { CsvImportInstructionsModal } from "../components/auth/CsvImportInstructionsModal";
import { Alert } from "../core/alert";
import type { TrackType } from "../core/types";

type Provider = 'spotify' | 'deezer' | 'csv' | 'manual';

// bibliothèque en attente de profil (pseudo + photo, cf. CsvProfileModal) :
// commune aux deux étapes finales de la connexion universelle (choix manuel
// des titres ou import CSV, cf. UniversalLoginChoiceModal) puisqu'elles
// aboutissent toutes deux au même écran de profil
type PendingLibrary = { provider: 'csv' | 'manual'; tracks: TrackType[]; total: number };

export const LoginScreen = () => {
    const navigation = useNavigation();
    const setToken = useAuthStore((s) => s.setToken);
    const setAuthenticated = useAuthStore((s) => s.setAuthenticated);
    const { setLikedTracks, setTotalTracks } = useTrackStore.getState();
    const [loadingProvider, setLoadingProvider] = useState<Provider | null>(null);
    const [isDeezerModalVisible, setIsDeezerModalVisible] = useState(false);
    const [deezerModalError, setDeezerModalError] = useState<string | undefined>(undefined);
    const [isProfileModalVisible, setIsProfileModalVisible] = useState(false);
    const [pendingLibrary, setPendingLibrary] = useState<PendingLibrary | null>(null);
    const [isUniversalChoiceVisible, setIsUniversalChoiceVisible] = useState(false);
    const [isCsvInstructionsVisible, setIsCsvInstructionsVisible] = useState(false);
    const manualPickerResult = useManualTrackPickerStore((s) => s.result);

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

    // ouvre le choix entre composer sa bibliothèque à la main ou l'importer
    // d'un fichier CSV (cf. UniversalLoginChoiceModal) — première étape de la
    // "Connexion universelle", pour les joueurs sans compte Spotify/Deezer
    const handleOpenUniversalLogin = () => {
        setIsUniversalChoiceVisible(true);
    };

    const handleChooseManualTracks = () => {
        setIsUniversalChoiceVisible(false);
        navigation.navigate('ManualTrackPicker');
    };

    const handleChooseCsvImport = () => {
        setIsUniversalChoiceVisible(false);
        setIsCsvInstructionsVisible(true);
    };

    const handleManualTracksConfirm = (tracks: TrackType[]) => {
        setPendingLibrary({ provider: 'manual', tracks, total: tracks.length });
        setIsProfileModalVisible(true);
    };

    // ManualTrackPickerScreen (poussé sur la pile, cf. Navigator.tsx) reste
    // au-dessus de cet écran tant qu'il est ouvert : cet écran-ci reste monté
    // en dessous et continue de recevoir les mises à jour du store — dès que
    // l'utilisateur valide sa sélection là-bas et revient (goBack), ce store
    // porte le résultat et cet effet prend le relais, comme le ferait un
    // onConfirm de modale classique (cf. useManualTrackPickerStore)
    useEffect(() => {
        if (!manualPickerResult) return;
        handleManualTracksConfirm(manualPickerResult);
        useManualTrackPickerStore.getState().clear();
    }, [manualPickerResult]);

    const handleCsvImportResult = (imported: CsvImportResult | null) => {
        if (!imported) return; // sélection annulée, on reste sur les instructions

        setPendingLibrary({ provider: 'csv', tracks: imported.tracks, total: imported.total });
        setIsCsvInstructionsVisible(false);
        setIsProfileModalVisible(true);

        // au-delà de 5000 titres, le reste du fichier est ignoré (même limite
        // que côté serveur, cf. modules/auth/csv.ts) : sans ce message,
        // l'utilisateur croirait que toute sa bibliothèque a été importée
        if (imported.truncated) {
            Alert.alert(
                'Bibliothèque tronquée',
                `Seuls les ${imported.total} premiers titres du fichier ont été importés (limite de 5000).`
            );
        }
    };

    const handleUploadCsv = async () => {
        if (loadingProvider) return;
        setLoadingProvider('csv');

        try {
            handleCsvImportResult(await importTracksFromCsv());
        } catch (error) {
            console.error(error);
            Alert.alert(
                'Fichier CSV invalide',
                error instanceof Error ? error.message : 'Impossible de lire ce fichier CSV'
            );
        } finally {
            setLoadingProvider(null);
        }
    };

    const handleLibraryProfileConfirm = (pseudo: string, img: string | null) => {
        if (!pendingLibrary) return;

        finalizeLogin(
            pendingLibrary.provider,
            {
                display_name: pseudo,
                id: `${pendingLibrary.provider}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
                email: '',
                img,
                account_type: pendingLibrary.provider,
            },
            pendingLibrary.tracks,
            pendingLibrary.total
        );

        setIsProfileModalVisible(false);
        setPendingLibrary(null);
        console.log(`✅ Connexion universelle (${pendingLibrary.provider}) réussie`);
    };

    return (
        <ScreenLayout>
            <View className="flex-1 justify-center items-center w-full">
                <Image
                    source={require('../images/logo.png')}
                    style={{ width: 150, height: 150, borderRadius: 16 }}
                />
                <View className="w-full gap-4">

                    <SectionTitle
                        title="Guesstracks"
                        subtitle="Connecte-toi avec ton service de musique préféré pour jouer avec tes amis."
                        align="center"
                        size="xl"
                        className="py-4"
                    />

                    <View className="flex-row gap-2.5">
                        <View className="flex-1">
                            <CustomButton
                                name="Connexion universelle"
                                iconFA="arrow-right-to-bracket"
                                onPress={handleOpenUniversalLogin}
                                variant="white"
                                available={!loadingProvider}
                            />
                        </View>
                    </View>

                    <CustomButton
                        name={loadingProvider === 'spotify' ? "Connexion..." : "Spotify"}
                        iconFA="spotify"
                        onPress={handleSpotifyLogin}
                        variant="spotify"
                        available={!loadingProvider}
                        loading={loadingProvider === 'spotify'}
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
                        name="Apple Music"
                        iconFA="apple"
                        onPress={() => console.log("Apple Music")}
                        variant="apple_music"
                        available={false}
                    />


                    {/* <CustomButton
                        name="Youtube Music"
                        iconFA="youtube"
                        onPress={() => console.log("Youtube Music")}
                        variant="youtube_music"
                        available={false}
                    /> */}

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

            <CsvProfileModal
                visible={isProfileModalVisible}
                onClose={() => {
                    setIsProfileModalVisible(false);
                    setPendingLibrary(null);
                }}
                onConfirm={handleLibraryProfileConfirm}
            />

            <UniversalLoginChoiceModal
                visible={isUniversalChoiceVisible}
                onClose={() => setIsUniversalChoiceVisible(false)}
                onChooseManual={handleChooseManualTracks}
                onChooseCsvImport={handleChooseCsvImport}
            />

            <CsvImportInstructionsModal
                visible={isCsvInstructionsVisible}
                onClose={() => setIsCsvInstructionsVisible(false)}
                onImport={handleUploadCsv}
                isImporting={loadingProvider === 'csv'}
            />

        </ScreenLayout>
    );
};