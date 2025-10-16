import { useEffect } from 'react';
import { View, Text, Alert, Image } from 'react-native';
import { useAuthStore } from '../stores/auth.store';
import { TrackStore } from '../stores/tracks.store';
import { spotifyService } from '../modules/spotify';
import { CustomButton } from "../components/Button";

export const HomeScreen = () => {
    const totalTracks = TrackStore((s) => s.totalTracks);
    const logoutFn = useAuthStore((s) => s.logout);
    const user = useAuthStore((s) => s.user);

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
        <View className="flex-1 bg-[#1a1a1a] items-center justify-between px-8 py-12">

            <View className="flex-1 justify-center items-center w-full">
                {user?.img && (
                    <Image
                        style={{ width: 120, height: 120, borderRadius: 60 }}
                        source={
                            user?.img
                                ? { uri: user.img } 
                                : require('../images/fallback.png') 
                        } />
                )}

                <Text className="text-2xl text-white mt-6 mb-2">
                    Bienvenue {user?.display_name} !
                </Text>

                <Text className="text-lg text-spotify-primary mb-4">
                    {user?.account_type}
                </Text>

                <Text className="text-base text-gray-400 mb-8">
                    {totalTracks} titres likés
                </Text>

                <View className="w-full gap-4">
                    <CustomButton
                        name="Créer une partie"
                        onPress={() => console.log('Créer')}
                        icon="plus"
                        className="bg-primary-start"
                    />

                    <CustomButton
                        name="Rejoindre une partie"
                        onPress={() => console.log('rejoindre')}
                        icon="users"
                        className="bg-zinc-700"
                    />
                </View>
            </View>

            <View className="w-full">
                <CustomButton
                    name="Déconnexion"
                    onPress={confirmLogout}
                    icon="arrow-right-from-bracket"
                    className="bg-red-500"
                />
            </View>
        </View>
    );
};