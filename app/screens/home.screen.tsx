import { useEffect } from 'react';
import { View, Text, Pressable } from 'react-native';
import { useAuthStore } from '../stores/auth.store';
import { TrackStore } from '../stores/tracks.store';
import { spotifyService } from '../modules/spotify';

export const HomeScreen = () => {
    const logout = useAuthStore((s) => s.logout);
    const totalTracks = TrackStore((s) => s.totalTracks);

    useEffect(() => {
        const loadTracks = async () => {
            try {
                const totalTracks = await spotifyService.getTotalTracks();

                TrackStore.getState().setTotalTracks(totalTracks);

                console.log(`✅ ${totalTracks} tracks récupérées`)
            } catch (error) {
                console.error('Erreur lors du chargement des tracks :', error);
            }
        };

        loadTracks();
    }, []);

    return (
        <View className="flex-1 bg-white items-center justify-center">
            <Text className="text-xl mb-4">Connecté</Text>

            <Pressable
                onPress={logout}
                className="bg-red-500 px-6 py-3 rounded-full mb-6"
            >
                <Text className="text-white font-bold">Déconnexion</Text>
            </Pressable>

            <Text className="text-lg text-gray-700">
                {totalTracks} titres aimés ❤️
            </Text>
        </View>
    );
};
