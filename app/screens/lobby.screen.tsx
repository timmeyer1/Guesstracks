// app/screens/lobby.screen.tsx
import React, { useState } from 'react'
import { View, Text, Alert, ScrollView } from 'react-native'
import { useNavigation } from "@react-navigation/native"

import { leaveLobby } from '../modules/lobby/lobby.service'
import { useLobbyStore } from "../stores/lobby.store"
import { LOBBY_LIMITS } from '../core/constants/lobby.constants'
import { useAuthStore } from "../stores/auth.store"
import { COLORS } from '../core/constants/colors.constants'

import { CustomButton } from "../components/Button"
import { IconButton } from "../components/IconButton"
import { ScreenLayout } from "../components/ScreenLayout"
import { LobbySettingsModal } from '../components/lobby/LobbySettingsModal'
import { GameModeCard } from '../components/GameModeCard'
import { PlayersGrid } from '../components/lobby/PlayersGrid'
import { SectionTitle } from '../components/SectionTitle'

const LobbyScreen = () => {
    const { lobby, users, updateLobbySettings } = useLobbyStore()
    const { token } = useAuthStore()
    const navigation = useNavigation()

    const [isSettingsModalVisible, setIsSettingsModalVisible] = useState(false)
    const [isGameModeSelected, setIsGameModeSelected] = useState(false)

    const isHost = users[0]?.token === token
    const canStartGame = users.length >= LOBBY_LIMITS.MIN_PLAYERS_TO_START && isGameModeSelected

    const handleLeaveLobby = () => {
        Alert.alert(
            "Attention !",
            "Es-tu sûr de vouloir quitter ce lobby ?",
            [
                { text: "Rester", style: "cancel" },
                {
                    text: "Quitter",
                    onPress: () => {
                        const result = leaveLobby()
                        if (result.shouldNavigate) {
                            navigation.reset({
                                index: 0,
                                routes: [{ name: 'Home' }],
                            })
                        }
                    },
                    style: "destructive"
                }
            ]
        )
    }

    const handleUpdateSettings = (settings: {
        gameMode: 'guesstracks' | 'blindtest'
        rounds: number
        phaseSpeed: 'slow' | 'normal' | 'fast'
    }) => {
        updateLobbySettings(settings)
        setIsGameModeSelected(true)
    }

    const handleStartGame = () => {
        if (!canStartGame) {
            Alert.alert(
                "Impossible de lancer",
                "Il faut au moins 2 joueurs et un mode de jeu sélectionné"
            )
            return
        }
        Alert.alert("C'est parti !", "La partie va commencer...")
    }

    const handleInvitePlayers = () => {
        Alert.alert("Inviter des joueurs", "Fonctionnalité à venir !")
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
            <View className="flex-1 w-full">
                <GameModeCard
                    gameMode={isGameModeSelected ? lobby.gameMode : undefined}
                    rounds={isGameModeSelected ? lobby.rounds : undefined}
                    phaseSpeed={isGameModeSelected ? lobby.phaseSpeed : undefined}
                />

                <SectionTitle
                    title={`Lobby de ${lobby.name}`}
                    align='center'
                    titleSize='md'
                    className="mb-4"
                />

                <ScrollView
                    className="flex-1 w-full"
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={{ paddingBottom: 20 }}
                >
                    <PlayersGrid
                        users={users.slice(0, lobby.max_player)}
                        maxPlayers={lobby.max_player}
                        onInvite={handleInvitePlayers}
                    />
                </ScrollView>

                <View className="w-full">
                    <View className="gap-3 w-full">
                        {isHost && !isGameModeSelected && (
                            <CustomButton
                                name="Choisir le jeu"
                                onPress={() => setIsSettingsModalVisible(true)}
                                icon="Music"
                                variant="dark"
                            />
                        )}

                        {isHost && isGameModeSelected && (
                            <CustomButton
                                name={canStartGame ? "Lancer la partie" : "En attente de joueurs..."}
                                onPress={handleStartGame}
                                icon="Play"
                                available={canStartGame}
                                variant={canStartGame ? "white" : "dark"}
                            />
                        )}
                    </View>

                    <View className="flex-row gap-6 pt-5 justify-center">
                        {isHost && isGameModeSelected && (
                            <IconButton
                                icon="Settings"
                                onPress={() => setIsSettingsModalVisible(true)}
                                variant="white"
                            />
                        )}

                        <IconButton
                            icon="LogOut"
                            onPress={handleLeaveLobby}
                            variant="white"
                            color={COLORS.disconnect}
                        />
                    </View>
                </View>
            </View>

            <LobbySettingsModal
                visible={isSettingsModalVisible}
                mode={isGameModeSelected ? "edit" : "create"}
                onClose={() => setIsSettingsModalVisible(false)}
                onConfirm={handleUpdateSettings}
                initialSettings={isGameModeSelected ? lobby : undefined}
            />
        </ScreenLayout>
    )
}

export default LobbyScreen