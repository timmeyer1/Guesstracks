// app/screens/lobby.screen.tsx
import React, { useCallback, useEffect, useState } from 'react'
import { View, ScrollView, Share } from 'react-native'
import { Alert } from '../core/alert'
import { useFocusEffect, useNavigation } from "@react-navigation/native"

import { leaveLobby, updateLobbySettings, kickPlayer, transferHost } from '../modules/lobby/lobby.service'
import {
    startWatchingGame,
    stopWatchingGame,
    leaveGame,
    submitMyTracks,
    startGame,
    confirmReturnedToLobby,
} from '../modules/game/game.service'
import { useLobbyStore } from "../stores/lobby.store"
import { useGameStore } from "../stores/game.store"
import { LOBBY_LIMITS } from '../core/constants/lobby.constants'
import { useAuthStore } from "../stores/auth.store"
import { COLORS } from '../core/constants/colors.constants'
import type { LobbyUserType } from '../core/types'

import { CustomButton } from "../components/Button"
import { IconButton } from "../components/IconButton"
import { ScreenLayout } from "../components/ScreenLayout"
import { CornerShape } from "../components/CornerShape"
import { StatusPill } from "../components/StatusPill"
import { LoadingSpinner } from "../components/LoadingSpinner"
import { LobbySettingsModal, type LobbySettings } from '../components/lobby/LobbySettingsModal'
import { GameModeCard } from '../components/lobby/GameModeCard'
import { PlayersGrid } from '../components/lobby/PlayersGrid'
import { PlayerActionsModal } from '../components/lobby/PlayerActionsModal'
import { SectionTitle } from '../components/SectionTitle'
import type { GamePhase } from '../core/types'

const GAME_IN_PROGRESS_PHASES: GamePhase[] = ['collecting', 'in_round', 'round_result']

const LobbyScreen = () => {
    const lobby = useLobbyStore((s) => s.lobby)
    const users = useLobbyStore((s) => s.users)
    const user = useAuthStore((s) => s.user)
    const gamePhase = useGameStore((s) => s.phase)
    const gameError = useGameStore((s) => s.error)
    const submittedPlayerIds = useGameStore((s) => s.submittedPlayerIds)
    const pendingReturnPlayerIds = useGameStore((s) => s.pendingReturnPlayerIds)
    const navigation = useNavigation()

    const [isSettingsModalVisible, setIsSettingsModalVisible] = useState(false)
    const [selectedPlayer, setSelectedPlayer] = useState<LobbyUserType | null>(null)
    const [isStartingGame, setIsStartingGame] = useState(false)

    const isHost = users[0]?.id === user?.id
    // ça vient du serveur, pas d'un state local, dcp tout le monde voit
    // pareil, même ceux qui arrivent après le choix des réglages
    const isGameModeSelected = lobby?.settingsConfirmed ?? false
    const hasEnoughPlayers = users.length >= LOBBY_LIMITS.MIN_PLAYERS_TO_START
    // le serveur bloque le lancement tant que tout le monde n'a pas envoyé
    // ses musiques, on le montre ici aussi pour que l'hôte ne clique pour rien
    const missingTrackSubmissions = users.filter((u) => !submittedPlayerIds.includes(u.id)).length
    // après une partie on bloque le relancement tant que tout le monde n'est
    // pas revenu au lobby (sinon la personne est virée après 30s d'inactivité)
    const missingReturns = users.filter((u) => pendingReturnPlayerIds.includes(u.id)).length
    const canStartGame =
        hasEnoughPlayers && isGameModeSelected && missingTrackSubmissions === 0 && missingReturns === 0

    // dès qu'on entre dans le lobby, on écoute la partie et on envoie ses
    // titres likés, dcp tout est prêt quand l'hôte lance
    useEffect(() => {
        if (!lobby) return

        // on repart avec un game store tout propre à chaque VRAI changement de
        // lobby, pas juste un retour dans le même. Sinon un joueur qui change
        // de lobby hérite des résidus de l'ancien (mauvaise phase, faux "en
        // attente de joueurs"...). reset() remplace tout d'un coup, rien
        // d'autre à vider derrière
        useGameStore.getState().reset()

        startWatchingGame()
        submitMyTracks()
        return () => stopWatchingGame()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [lobby?.code])

    // tout le monde est redirigé dès que le serveur lance la partie. On liste
    // les phases "en cours" à la main plutôt que tester `!== 'idle'`, parce
    // que 'finished' compte aussi et ça renvoyait direct vers l'écran de jeu
    // quand on cliquait "Rester dans le lobby" — un bug silencieux qui
    // pouvait bloquer l'app sur un écran vide
    useEffect(() => {
        if (GAME_IN_PROGRESS_PHASES.includes(gamePhase)) {
            navigation.navigate('Game')
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [gamePhase])

    // ex: "pas assez de musiques likées en commun", "seul l'hôte peut lancer"...
    useEffect(() => {
        if (!gameError) return
        setIsStartingGame(false)
        Alert.alert("Impossible de lancer la partie", gameError)
        useGameStore.getState().setError(null)
    }, [gameError])

    // cet écran reste monté dans la pile (goBack le réaffiche tel quel), donc
    // sans ce reset le bouton resterait bloqué sur "Lancement..." pour
    // toujours. On prévient aussi le serveur que ce joueur est bien revenu au
    // lobby, ça couvre tous les chemins de retour possibles
    useFocusEffect(
        useCallback(() => {
            setIsStartingGame(false)
            confirmReturnedToLobby()
        }, [])
    )

    // détecte qu'on a été expulsé : on n'est plus dans la liste envoyée par le serveur
    useEffect(() => {
        if (!lobby || !user || users.length === 0) return
        const stillIn = users.some((u) => u.id === user.id)
        if (stillIn) return

        Alert.alert("Expulsé", "L'hôte t'a retiré de ce lobby.")
        leaveGame()
        useLobbyStore.getState().resetLobby()
        navigation.reset({ index: 0, routes: [{ name: 'Home' }] })
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [users, lobby, user])

    const handleLeaveLobby = () => {
        Alert.alert(
            "Attention !",
            "Es-tu sûr de vouloir quitter ce lobby ?",
            [
                { text: "Rester", style: "cancel" },
                {
                    text: "Quitter",
                    // en mode test perf : leaveLobby() gère déjà ses erreurs
                    // réseau tout seul et annule jamais le départ, dcp attendre
                    // sa réponse avant de naviguer servait à rien
                    onPress: () => {
                        leaveLobby()
                        leaveGame()
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

    const handleUpdateSettings = async (settings: LobbySettings) => {
        const result = await updateLobbySettings(settings)
        if (!result.ok) {
            Alert.alert("Impossible de sauvegarder", result.error)
        }
    }

    const handleStartGame = () => {
        if (!canStartGame) {
            Alert.alert(
                "Impossible de lancer",
                "Il faut au moins 2 joueurs et un mode de jeu sélectionné"
            )
            return
        }
        if (isStartingGame) return
        setIsStartingGame(true)
        // le serveur envoie "game:started" à tout le lobby, ça redirige chaque
        // joueur vers l'écran de jeu
        startGame()
    }

    const handleSelectPlayer = (player: LobbyUserType) => {
        if (!isHost || player.id === user?.id) return
        setSelectedPlayer(player)
    }

    const handleTransferHost = async () => {
        if (!selectedPlayer) return
        const target = selectedPlayer
        setSelectedPlayer(null)
        const result = await transferHost(target.id)
        if (!result.ok) Alert.alert("Impossible", result.error)
    }

    const handleKickPlayer = async () => {
        if (!selectedPlayer) return
        const target = selectedPlayer
        setSelectedPlayer(null)
        const result = await kickPlayer(target.id)
        if (!result.ok) Alert.alert("Impossible", result.error)
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

    // ça devrait s'afficher qu'une frame, pendant la transition après un
    // départ/une expulsion du lobby. Un spinner plutôt que rien du tout, parce
    // qu'un écran vide ressemble à un crash pour l'utilisateur — si jamais ça
    // dure plus longtemps que prévu, mieux vaut un spinner visible qu'un écran
    // blanc muet
    if (!lobby) {
        return (
            <ScreenLayout centered>
                <LoadingSpinner size={32} color={COLORS.primary} />
            </ScreenLayout>
        )
    }

    return (
        <ScreenLayout
            shapes={
                <>
                    <CornerShape size="50%" rotate={-70} top="-17%" right="-15%" />
                    <CornerShape size="50%" rotate={168} top="52%" left="-43%" />
                    <CornerShape size="50%" rotate={50} bottom="-20%" right="-19%" />
                </>
            }
        >
            <View className="flex-1 w-full">
                <GameModeCard
                    gameMode={isGameModeSelected ? lobby.gameMode : undefined}
                    rounds={isGameModeSelected ? lobby.rounds : undefined}
                    phaseSpeed={isGameModeSelected ? lobby.phaseSpeed : undefined}
                    onSettingsPress={isHost && isGameModeSelected ? () => setIsSettingsModalVisible(true) : undefined}
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
                    // Android seulement : sans ça, l'écran natif capte le
                    // glissement vertical avant la ScrollView, dcp la liste
                    // s'affiche mais réagit à rien quand on scrolle
                    nestedScrollEnabled
                >
                    <PlayersGrid
                        users={users}
                        maxPlayers={lobby.max_player}
                        onInvite={handleInvitePlayers}
                        currentUserId={user?.id}
                        onSelectPlayer={isHost ? handleSelectPlayer : undefined}
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
                            canStartGame ? (
                                <CustomButton
                                    name={isStartingGame ? "Lancement..." : "Lancer la partie"}
                                    onPress={handleStartGame}
                                    icon="Play"
                                    variant="white"
                                    available={!isStartingGame}
                                    loading={isStartingGame}
                                />
                            ) : (
                                <StatusPill
                                    text={
                                        !hasEnoughPlayers
                                            ? "En attente de joueurs"
                                            : missingReturns > 0
                                                ? missingReturns === 1
                                                    ? "En attente qu'un joueur revienne au lobby"
                                                    : `En attente que ${missingReturns} joueurs reviennent au lobby`
                                                : missingTrackSubmissions === 1
                                                    ? "En attente des musiques d'un joueur"
                                                    : `En attente des musiques de ${missingTrackSubmissions} joueurs`
                                    }
                                />
                            )
                        )}

                        {!isHost && isGameModeSelected && (
                            <StatusPill text="En attente de l'hôte" />
                        )}
                    </View>

                    <View className="flex-row gap-6 pt-5 justify-center">
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

            <PlayerActionsModal
                player={selectedPlayer}
                onClose={() => setSelectedPlayer(null)}
                onTransferHost={handleTransferHost}
                onKick={handleKickPlayer}
            />
        </ScreenLayout>
    )
}

export default LobbyScreen
