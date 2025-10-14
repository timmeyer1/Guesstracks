import { View, Text, Pressable } from 'react-native';
import { loginWithSpotify } from '../modules/spotify/spotify.service';
import { useAuthStore } from '../stores/auth.store';

export const LoginScreen = () => {
    const setToken = useAuthStore((s) => s.setToken);

    const handleLogin = async () => {
        const data = await loginWithSpotify();
        if (data?.access_token) setToken(data.access_token);
    };

    return (
        <View className="flex-1 bg-white items-center justify-center">
            <Pressable
                onPress={handleLogin}
                className="bg-green-500 px-8 py-4 rounded-full"
            >
                <Text className="text-white font-bold text-lg">spotify</Text>
            </Pressable>
        </View>
    );
};