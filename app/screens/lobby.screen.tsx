import React from 'react';
import { View, Text, Image, FlatList, Alert } from 'react-native';
import { useLobbyStore } from "../stores/lobby.store";
import { useNavigation } from "@react-navigation/native";
import { CustomButton } from "../components/Button";
import { ScreenLayout } from "../components/ScreenLayout";
import { leaveLobby } from '../modules/lobby/lobby.service';

const LobbyScreen = () => {
    const { lobby, users } = useLobbyStore();
    const navigation = useNavigation();

    const handleLeaveLobby = () => {
        if (lobby) {
            Alert.alert(
                "Attention !",
                `Es-tu sûr de vouloir quitter ce lobby ?`,
                [
                    {
                        text: "Rester dans le lobby",
                        onPress: () => {
                            navigation.navigate('Lobby');
                        },
                        style: "default",
                    },
                    {
                        text: "Quitter le lobby",
                        onPress: () => {
                            leaveLobby();
                            navigation.reset({
                                index: 0,
                                routes: [{ name: 'Home' }], 
                            });
                        },
                        style: "destructive"
                    }
                ]
            );
            return;
        }
    };

    if (!lobby) {
        return (
            <ScreenLayout centered>
                <Text className="text-2xl text-white font-bold mb-4">
                    Aucun lobby actif 😕
                </Text>
                <Text className="text-base text-gray-400 text-center">
                    Crée un lobby depuis l'accueil pour commencer.
                </Text>
            </ScreenLayout>
        );
    }

    return (
        <ScreenLayout>
            <Text className="text-2xl text-white font-bold text-center mb-2">
                {lobby.name}
            </Text>
            <Text className="text-base text-gray-400 text-center mb-6">
                {lobby.nb_player}/{lobby.max_player} joueurs
            </Text>

            <FlatList
                data={users}
                keyExtractor={(item) => item.token}
                renderItem={({ item }) => (
                    <View className="flex-row items-center bg-zinc-800 rounded-lg p-4 mb-3">
                        <Image
                            source={{ uri: item.img || 'https://i.pravatar.cc/100' }}
                            className="w-12 h-12 rounded-full mr-4"
                        />
                        <View>
                            <Text className="text-white text-base font-semibold">
                                {item.name}
                            </Text>
                            <Text className="text-gray-400 text-sm">
                                {item.account_type}
                            </Text>
                        </View>
                    </View>
                )}
                ListEmptyComponent={
                    <Text className="text-gray-500 text-center mt-8">
                        Aucun joueur pour le moment
                    </Text>
                }
            />

            <View className="mt-6">
                <CustomButton
                    name={'Quitter le lobby'}
                    onPress={handleLeaveLobby}
                    icon="arrow-right-from-bracket"
                    className="bg-red-500"
                />
            </View>
        </ScreenLayout>
    );
};

export default LobbyScreen;