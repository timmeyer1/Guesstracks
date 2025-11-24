import React, { useState } from 'react'
import { View, Text, Image, FlatList, Alert } from 'react-native'
import { useLobbyStore } from "../stores/lobby.store"
import { useAuthStore } from "../stores/auth.store"
import { useNavigation } from "@react-navigation/native"
import { CustomButton } from "../components/Button"
import { ScreenLayout } from "../components/ScreenLayout"
import { leaveLobby } from '../modules/lobby/lobby.service'
import { LobbySettingsModal } from '../components/lobby/LobbySettingsModal'
import { GAME_MODES, PHASE_SPEEDS, LOBBY_LIMITS, getLobbyInfoText } from '../core/constants/lobby.constants'

const LobbyScreen = () => {
    const { lobby, users, updateLobbySettings } = useLobbyStore()
    const { token } = useAuthStore()
    const navigation = useNavigation()

    const [isEditModalVisible, setIsEditModalVisible] = useState(false)

    // le premier user est l'hôte
    const isHost = users[0]?.token === token

    // vérifie le nmbre de joueur avant lancement
    const canStartGame = users.length >= LOBBY_LIMITS.MIN_PLAYERS_TO_START

    const handleLeaveLobby = () => {
        if (lobby) {
            Alert.alert(
                "Attention !",
                `Es-tu sûr de vouloir quitter ce lobby ?`,
                [
                    { text: "Rester", style: "cancel" },
                    {
                        text: "Quitter",
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

    const handleUpdateSettings = (settings: { gameMode: 'guesstracks' | 'blindtest'; rounds: number; phaseSpeed: 'slow' | 'normal' | 'fast' }) => {
        updateLobbySettings(settings)
        Alert.alert(
            "Paramètres mis à jour !",
            getLobbyInfoText(settings.gameMode, settings.rounds, settings.phaseSpeed)
        )
    }

    const handleStartGame = () => {
        if (!canStartGame) {
            Alert.alert("Impossible de lancer", "Il faut au moins 2 joueurs pour commencer")
            return
        }
        // TODO: logique pour démarrer la partie
        Alert.alert("C'est parti !", "La partie va commencer...")
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

            <Text className="text-base text-gray-400 text-center mb-4">
                {lobby.nb_player}/{lobby.max_player} joueurs
            </Text>

            <View className="bg-zinc-800 rounded-lg p-4 mb-4">
                <Text className="text-white font-semibold mb-2 text-center">
                    {GAME_MODES[lobby.gameMode].icon} {GAME_MODES[lobby.gameMode].label}
                </Text>
                <View className="flex-row justify-center gap-4">
                    <Text className="text-gray-400 text-sm">
                        🎮 {lobby.rounds} manches
                    </Text>
                    <Text className="text-gray-400 text-sm">
                        ⚡ {PHASE_SPEEDS[lobby.phaseSpeed].label} ({PHASE_SPEEDS[lobby.phaseSpeed].durationLabel})
                    </Text>
                </View>
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
                        name={canStartGame ? "Lancer la partie" : "En attente de joueurs..."}
                        onPress={handleStartGame}
                        icon="play"
                        className={canStartGame ? "bg-green-600" : "bg-zinc-600"}
                        disabled={canStartGame}
                    />
                )}

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