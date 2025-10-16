import { useEffect } from 'react';
import { View, Text, Alert } from 'react-native';
import { useAuthStore } from '../stores/auth.store';
import { TrackStore } from '../stores/tracks.store';
import { spotifyService } from '../modules/spotify';
import { CustomButton } from "../components/Button";

export const HomeScreen = () => {
    const totalTracks = TrackStore((s) => s.totalTracks);
    const logoutFn = useAuthStore((s) => s.logout);

    useEffect(() => {
        const loadTracks = async () => {
            try {
                const totalTracks = await spotifyService.getTotalTracks();
                TrackStore.getState().setTotalTracks(totalTracks);
                console.log(`✅ ${totalTracks} tracks récupérées`);
            } catch (error) {
                console.error('Erreur lors du chargement des tracks :', error);
            }
        };

        loadTracks();
    }, []);

    const confirmLogout = () => {
        Alert.alert(
            "Déconnexion",
            "Es-tu sûr de vouloir te déconnecter ?",
            [
                { text: "Annuler", style: "cancel" },
                { text: "Oui", onPress: () => logoutFn() },
            ],
            { cancelable: true }
        );
    };

    return (
        <View className="flex-1 bg-spotify-lightdark items-center justify-center px-6">
            <Text className="text-xl mb-4 text-white">Connecté</Text>

            <CustomButton
                name="Déconnexion"
                onPress={confirmLogout}
                icon="arrow-right-from-bracket"
                className="bg-red-500 mb-4"
            />

            <Text className="text-lg text-white">
                {totalTracks} titres likés
            </Text>
        </View>
    );
};
