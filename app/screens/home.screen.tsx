import { useEffect } from 'react';
import { View, Text, Alert,Image } from 'react-native';
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

    const user = useAuthStore((s) => s.user);

    return (
        <View className="flex-1 bg-spotify-lightdark items-center justify-between px-6 py-20 gap-2">

            <View className={'flex flex-col justify-evenly items-center'}>
                {user?.img && <Image style={{ width: 150, height: 150, borderRadius: 75 }} source={require('../images/fallback.png')}/>}
                <Text className="text-xl mb-4 text-white my-4">Bienvenue {user?.display_name} !</Text>
                <Text className="text-xl mb-4 text-spotify-primary">{user?.account_type}</Text>
                <Text className="text-lg text-white">
                    {totalTracks} titres likés
                </Text>
            </View>

            <View className={'flex flex-col justify-center gap-2 items-center'}>
                <CustomButton
                    name="Déconnexion"
                    onPress={confirmLogout}
                    icon="arrow-right-from-bracket"
                    className="bg-red-500 mb-4"
                />


            </View>

        </View>
    );
};
