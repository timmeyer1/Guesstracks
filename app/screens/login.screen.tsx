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

// en gros c'est la bibliothèque qui attend un profil (pseudo + photo) :
// que tu aies importé un CSV ou choisi tes titres à la main, tu passes
// par le même écran de profil à la fin
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

    // pose le profil et les titres likés, puis authentifie en dernier —
    // dcp la navigation se déclenche seulement quand tout est prêt. Sinon
    // le joueur arriverait dans le lobby avec 0 titre, et ça ne se
    // rattrape jamais après coup
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

            // on pose le token direct, l'API va le relire dans le store juste après
            setToken(data.access_token);

            // profil et titres likés sont indépendants, dcp on les récupère en
            // même temps plutôt que l'un après l'autre, ça va plus vite
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

    // en mode la connexion OAuth Deezer existe déjà mais elle dort, parce que
    // créer une app sur Deezer est cassé depuis ~2 ans, dcp impossible d'avoir
    // les identifiants. En attendant on regarde juste le profil public par
    // ID/lien, faut juste que ses titres likés soient publics
    const handleDeezerProfileLogin = async (profileInput: string) => {
        if (loadingProvider) return;
        setDeezerModalError(undefined);

        const userId = extractDeezerProfileId(profileInput);
        if (!userId) {
            setDeezerModalError('Lien ou ID de profil Deezer invalide');
            return;
        }

        setLoadingProvider('deezer');
        // pas de token ici, on efface un éventuel vieux token Spotify qui traînerait
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

    // première étape de la connexion universelle : choisir ses titres à la
    // main ou importer un CSV, pour ceux qui ont ni Spotify ni Deezer
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

    // l'écran de choix manuel des titres reste au-dessus, celui-ci reste
    // monté en dessous. Dès que le joueur valide et revient en arrière, le
    // store récupère le résultat et cet effet prend la suite, comme un
    // onConfirm de modale classique
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

        // au-delà de 5000 titres on ignore le reste (même limite côté serveur),
        // dcp on prévient sinon le joueur croit que tout est importé
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

                    {/* déplacé dans le bloc des boutons : avant il dépendait d'un
                    calcul flex différent et pouvait chevaucher le dernier
                    bouton sur web au lieu de s'afficher dessous */}
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