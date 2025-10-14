import { View, Text, Pressable } from 'react-native';
import { useAuthStore } from '../stores/auth.store';

export const HomeScreen = () => {
    const logout = useAuthStore((s) => s.logout);

    return (
        <View className="flex-1 bg-white items-center justify-center">
            <Text className="text-xl">connecté</Text>
            <Pressable onPress={logout} className="bg-red-500 px-6 py-3 rounded-full">
                <Text className="text-white font-bold">déconnexion</Text>
            </Pressable>
        </View>
    );
};