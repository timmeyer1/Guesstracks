import React, { useState } from 'react'
import { View, Text, Image, FlatList, Alert } from 'react-native'
import { useLobbyStore } from "../stores/lobby.store"
import { useAuthStore } from "../stores/auth.store"
import { useNavigation } from "@react-navigation/native"
import { CustomButton } from "../components/Button"
import { ScreenLayout } from "../components/ScreenLayout"
import { leaveLobby } from '../modules/lobby/lobby.service'
import { LobbySettingsModal } from '../components/lobby/LobbySettingsModal'

const LobbyScreen = () => {
    const { lobby, users, updateLobbySettings } = useLobbyStore()
    const { token } = useAuthStore()
    const navigation = useNavigation()

    const [isEditModalVisible, setIsEditModalVisible] = useState(false)

    // user = hôte ?
    const isHost = users[0]?.token === token

    const handleLeaveLobby = () => {
        if (lobby) {
            Alert.alert(
                "Attention !",
                `Es-tu sûr de vouloir quitter ce lobby ?`,
                [
                    {
                        text: "Rester dans le lobby",
                        style: "default",
                    },
                    {
                        text: "Quitter le lobby",
                        onPress: () => {
                            leaveLobby()
                            navigation.reset({
                                index: 0,
                                routes: [{ name: 'Home' }],
                            })
                        },
                        style: "destructive"
                    }
                ]
            )
        }
    }

    const handleUpdateSettings = (settings: { rounds: number; phaseSpeed: 'lent' | 'normal' | 'rapide' }) => {
        updateLobbySettings(settings)
        Alert.alert("Paramètres mis à jour !", `${settings.rounds} manches en mode ${settings.phaseSpeed}`)
    }

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
        )
    }

    return (
        <ScreenLayout>
            <Text className="text-2xl text-white font-bold text-center mb-2">
                {lobby.name}
            </Text>
            <Text className="text-base text-gray-400 text-center mb-2">
                {lobby.nb_player}/{lobby.max_player} joueurs
            </Text>

            <View className="bg-zinc-800 rounded-lg p-3 mb-4">
                <Text className="text-gray-400 text-sm text-center">
                    🎮 {lobby.rounds} manches • ⚡ Vitesse {lobby.phaseSpeed}
                </Text>
            </View>

            <FlatList
                data={users}
                keyExtractor={(item) => item.token}
                renderItem={({ item, index }) => (
                    <View className="flex-row items-center bg-zinc-800 rounded-lg p-4 mb-3">
                        <Image
                            source={{ uri: item.img || 'https://i.pravatar.cc/100' }}
                            className="w-12 h-12 rounded-full mr-4"
                        />
                        <View className="flex-1">
                            <View className="flex-row items-center">
                                <Text className="text-white text-base font-semibold">
                                    {item.name}
                                </Text>
                                {index === 0 && (
                                    <Text className="ml-2 text-xs bg-primary-start px-2 py-1 rounded-full text-white">
                                        Hôte
                                    </Text>
                                )}
                            </View>
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

            <View className="mt-6 gap-3">
                {isHost && (
                    <CustomButton
                        name="Modifier les paramètres"
                        onPress={() => setIsEditModalVisible(true)}
                        icon="gear"
                        className="bg-zinc-700"
                    />
                )}

                <CustomButton
                    name="Quitter le lobby"
                    onPress={handleLeaveLobby}
                    icon="arrow-right-from-bracket"
                    className="bg-red-500"
                />
            </View>

            {lobby && (
                <LobbySettingsModal
                    visible={isEditModalVisible}
                    mode="edit"
                    onClose={() => setIsEditModalVisible(false)}
                    onConfirm={handleUpdateSettings}
                    initialSettings={lobby}
                />
            )}
        </ScreenLayout>
    )
}

export default LobbyScreen