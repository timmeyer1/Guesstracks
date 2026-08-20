// app/screens/lobby.screen.tsx
import React, { useEffect, useState } from 'react'
import { View, Text, Alert, ScrollView, Share } from 'react-native'
import { useNavigation } from "@react-navigation/native"

import { leaveLobby, updateLobbySettings } from '../modules/lobby/lobby.service'
import { startWatchingGame, stopWatchingGame, leaveGame, submitMyTracks, startGame } from '../modules/game/game.service'
import { useLobbyStore } from "../stores/lobby.store"
import { useGameStore } from "../stores/game.store"
import { LOBBY_LIMITS } from '../core/constants/lobby.constants'
import { useAuthStore } from "../stores/auth.store"
import { COLORS } from '../core/constants/colors.constants'

import { CustomButton } from "../components/Button"
import { IconButton } from "../components/IconButton"
import { ScreenLayout } from "../components/ScreenLayout"
import { LobbySettingsModal } from '../components/lobby/LobbySettingsModal'
import { GameModeCard } from '../components/lobby/GameModeCard'
import { PlayersGrid } from '../components/lobby/PlayersGrid'
import { SectionTitle } from '../components/SectionTitle'

const LobbyScreen = () => {
    const { lobby, users } = useLobbyStore()
    const { user } = useAuthStore()
    const gamePhase = useGameStore((s) => s.phase)
    const gameError = useGameStore((s) => s.error)
    const navigation = useNavigation()

    const [isSettingsModalVisible, setIsSettingsModalVisible] = useState(false)
    const [isGameModeSelected, setIsGameModeSelected] = useState(false)

    const isHost = users[0]?.id === user?.id
    const canStartGame = users.length >= LOBBY_LIMITS.MIN_PLAYERS_TO_START && isGameModeSelected

    // écoute les événements de partie dès l'entrée dans le lobby, et envoie ses
    // titres likés pour que le pool soit prêt quand l'hôte lancera la partie
    useEffect(() => {
        if (!lobby) return
        startWatchingGame()
        submitMyTracks()
        return () => stopWatchingGame()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [lobby?.code])

    // tous les joueurs (pas seulement l'hôte) sont redirigés dès que le
    // serveur démarre la partie
    useEffect(() => {
        if (gamePhase !== 'idle') {
            navigation.navigate('Game')
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [gamePhase])

    // ex: "pas assez de musiques likées en commun", "seul l'hôte peut lancer"...
    useEffect(() => {
        if (!gameError) return
        Alert.alert("Impossible de lancer la partie", gameError)
        useGameStore.getState().setError(null)
    }, [gameError])

    const handleLeaveLobby = () => {
        Alert.alert(
            "Attention !",
            "Es-tu sûr de vouloir quitter ce lobby ?",
            [
                { text: "Rester", style: "cancel" },
                {
                    text: "Quitter",
                    onPress: async () => {
                        const result = await leaveLobby()
                        leaveGame()
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

    const handleUpdateSettings = async (settings: {
        gameMode: 'guesstracks' | 'blindtest'
        rounds: number
        phaseSpeed: 'slow' | 'normal' | 'fast'
    }) => {
        const result = await updateLobbySettings(settings)
        if (!result.ok) {
            Alert.alert("Impossible de sauvegarder", result.error)
            return
        }
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
        // le serveur diffuse "game:started" à tout le lobby, qui redirige
        // chaque joueur vers l'écran de jeu (cf. l'effet sur gamePhase ci-dessus)
        startGame()
    }

    const handleInvitePlayers = async () => {
        if (!lobby) return
        try {
            await Share.share({
                message: `Rejoins ma partie sur Guesstracks avec le code ${lobby.code} !`,
            })
        } catch (error) {
            console.warn('⚠️ Erreur de partage:', error)
        }
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
                    subtitle={`Code : ${lobby.code}`}
                    align='center'
                    titleSize='md'
                    subtitleSize='sm'
                    className="mb-4"
                />

                <ScrollView
                    className="flex-1 w-full"
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={{ paddingBottom: 20 }}
                >
                    <PlayersGrid
                        users={users}
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
