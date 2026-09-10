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
    // dérivé de l'état serveur partagé (et non d'un état local) pour que tous
    // les joueurs voient la même chose, y compris ceux qui rejoignent après
    // que l'hôte a déjà choisi les réglages
    const isGameModeSelected = lobby?.settingsConfirmed ?? false
    const hasEnoughPlayers = users.length >= LOBBY_LIMITS.MIN_PLAYERS_TO_START
    // le serveur refuse de toute façon de lancer tant que tout le monde n'a
    // pas envoyé ses musiques likées (cf. game.service.js) : on reflète cette
    // même contrainte ici pour ne pas laisser l'hôte cliquer dans le vide
    const missingTrackSubmissions = users.filter((u) => !submittedPlayerIds.includes(u.id)).length
    // après une partie, bloque le relancement tant que tout le monde n'est
    // pas explicitement revenu au lobby (ou ne l'a pas quitté) — cf.
    // game.service.js, qui expulse pour inactivité au bout de 30s
    const missingReturns = users.filter((u) => pendingReturnPlayerIds.includes(u.id)).length
    const canStartGame =
        hasEnoughPlayers && isGameModeSelected && missingTrackSubmissions === 0 && missingReturns === 0

    // écoute les événements de partie dès l'entrée dans le lobby, et envoie ses
    // titres likés pour que le pool soit prêt quand l'hôte lancera la partie
    useEffect(() => {
        if (!lobby) return

        // Repart d'un game store totalement propre à chaque changement RÉEL de
        // lobby (pas à chaque retour dans le MÊME lobby, cf. la dépendance sur
        // lobby.code) : un joueur qui rejoint un nouveau lobby juste après avoir
        // quitté/été expulsé d'un ancien (ou qui y revient et en devient l'hôte)
        // ne doit hériter d'aucun résidu de cet ancien lobby — ni son `phase`
        // (sinon renvoi vers l'écran de jeu de l'ancienne partie), ni ses
        // submittedPlayerIds/pendingReturnPlayerIds (sinon "En attente que 3
        // joueurs..." fantôme dans un lobby où personne n'a encore joué).
        // reset() ici est un remplacement complet (cf. game.store.ts), pas une
        // fusion partielle : il n'y a donc rien d'autre à vider à la main.
        useGameStore.getState().reset()

        startWatchingGame()
        submitMyTracks()
        return () => stopWatchingGame()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [lobby?.code])

    // tous les joueurs (pas seulement l'hôte) sont redirigés dès que le
    // serveur démarre la partie. Liste explicite des phases "partie en cours"
    // plutôt que `!== 'idle'` : cette dernière incluait aussi 'finished', qui
    // est justement la phase dont on part en pressant "Rester dans le lobby"
    // (cf. handleStayInLobby dans game.screen.tsx). S'il restait la moindre
    // fenêtre où cet écran se re-rendait avec gamePhase encore à 'finished'
    // avant que le reset local n'ait fini de se propager, cet effet renvoyait
    // aussitôt vers l'écran de jeu — un aller-retour de navigation silencieux
    // (aucune exception, donc aucun log) qui pouvait laisser l'app bloquée
    // sur un écran incohérent/vide.
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

    // le stack navigator garde cet écran monté (goBack le réaffiche tel quel,
    // ex: "Rester dans le lobby" depuis les résultats finaux) : sans ce reset,
    // isStartingGame resterait bloqué à true après un lancement réussi et le
    // bouton resterait grisé sur "Lancement..." indéfiniment. On en profite
    // pour signaler au serveur que ce joueur est bien de retour au lobby (cf.
    // missingReturns ci-dessus) : couvre aussi bien "Rester dans le lobby"
    // que tout autre chemin de retour à cet écran.
    useFocusEffect(
        useCallback(() => {
            setIsStartingGame(false)
            confirmReturnedToLobby()
        }, [])
    )

    // détecte une expulsion par l'hôte : on n'apparaît plus dans la liste
    // diffusée par le serveur
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
                    // EXPÉRIMENTAL — navigation optimisée (cf. discussion audit
                    // perf) : leaveLobby() avale déjà ses propres erreurs réseau
                    // (log + continue, cf. lobby.service.ts) sans jamais annuler
                    // le départ, donc attendre sa réponse avant de naviguer ne
                    // protégeait contre rien — juste un aller-retour réseau
                    // masqué derrière la transition au lieu d'être devant.
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
        // le serveur diffuse "game:started" à tout le lobby, qui redirige
        // chaque joueur vers l'écran de jeu (cf. l'effet sur gamePhase ci-dessus)
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

    // ne devrait s'afficher que le temps d'une frame pendant la transition de
    // navigation qui suit un départ/une expulsion du lobby (cf. handleLeaveLobby
    // et la détection d'expulsion ci-dessus, qui redirigent vers Home juste après).
    // Un indicateur de chargement plutôt que `return null` : un écran vide sans
    // aucun visuel est indiscernable d'un plantage silencieux pour l'utilisateur
    // (cf. le bug du "Rester dans le lobby" plus haut) — si ce cas venait à durer
    // plus qu'une frame pour une raison qu'on n'a pas anticipée, mieux vaut un
    // spinner visible qu'un écran blanc muet.
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
                    // Android uniquement : sans ça, le conteneur natif de l'écran
                    // (react-native-screens) intercepte le geste de glissement
                    // vertical avant que cette ScrollView ne le récupère, même
                    // sans ScrollView parent visible côté JS (cf. même bug déjà
                    // rencontré sur TrackSuggestionsList) — la liste reste
                    // affichée mais ne réagit à aucun glissement
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
