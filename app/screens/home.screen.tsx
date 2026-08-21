import { useEffect, useState } from 'react'
import { View, Alert } from 'react-native'
import { useAuthStore } from '../stores/auth.store'
import { TrackStore } from '../stores/tracks.store'
import { spotifyService } from '../modules/spotify'
import { deezerService } from '../modules/deezer'
import { createLobby, joinLobby } from "../modules/lobby/lobby.service"
import { useNavigation } from '@react-navigation/native'
import { COLORS } from '../core/constants/colors.constants'
import { JoinLobbyModal } from '../components/home/JoinLobbyModal'
import { UserProfileCard } from '../components/UserProfileCard'
import { SectionTitle } from '../components/SectionTitle'
import { IconButton } from '../components/IconButton'
import { ScreenLayout } from '../components/ScreenLayout'
import { CustomButton } from '../components/Button'
import { CornerShape } from '../components/CornerShape'

export const HomeScreen = () => {
    const totalTracks = TrackStore((s) => s.totalTracks)
    const logoutFn = useAuthStore((s) => s.logout)
    const user = useAuthStore((s) => s.user)
    const navigation = useNavigation()

    const [isJoinModalVisible, setIsJoinModalVisible] = useState(false)
    const [joinError, setJoinError] = useState<string | undefined>(undefined)
    const [isJoining, setIsJoining] = useState(false)
    const [isCreating, setIsCreating] = useState(false)

    useEffect(() => {
        const loadTracks = async () => {
            try {
                const { user: currentUser, token } = useAuthStore.getState()
                let total: number
                if (currentUser?.provider === 'deezer') {
                    // avec token : connexion OAuth ("me", cf. modules/auth/deezer.ts,
                    // dormante). Sans token : lookup de profil public par id (chemin
                    // actif tant que la création d'app Deezer est cassée, cf.
                    // screens/login.screen.tsx)
                    total = token
                        ? await deezerService.getTotalTracks()
                        : await deezerService.getPublicTotalTracks(currentUser.id)
                } else {
                    total = await spotifyService.getTotalTracks()
                }
                TrackStore.getState().setTotalTracks(total)
                console.log(`✅ ${total} tracks récupérées`)
            } catch (error) {
                console.error('Erreur chargement tracks :', error)
            }
        }
        loadTracks()
    }, [])

    const confirmLogout = () => {
        Alert.alert(
            "Déconnexion",
            "Es-tu sûr de vouloir te déconnecter ?",
            [
                { text: "Annuler", style: "cancel" },
                { text: "Oui", onPress: logoutFn },
            ],
            { cancelable: true }
        )
    }

    const handleCreateLobby = async () => {
        if (isCreating) return
        setIsCreating(true)
        const result = await createLobby()
        setIsCreating(false)

        if (!result.ok) {
            Alert.alert("Impossible de créer la partie", result.error)
            return
        }
        navigation.navigate("Lobby")
    }

    const handleOpenJoinModal = () => {
        setJoinError(undefined)
        setIsJoinModalVisible(true)
    }

    const handleJoinLobby = async (code: string) => {
        if (isJoining) return
        setIsJoining(true)
        const result = await joinLobby(code)
        setIsJoining(false)

        if (!result.ok) {
            setJoinError(result.error)
            return
        }
        setJoinError(undefined)
        setIsJoinModalVisible(false)
        navigation.navigate("Lobby")
    }

    return (
        <ScreenLayout
            shapes={
                <>
                    <CornerShape size="50%" rotate={90} top="-20%" left={-65} />
                    <CornerShape size="50%" rotate={20} top="45%" right="-40%" />
                    <CornerShape size="50%" rotate={-40} bottom="-18%" left="-20%" />
                </>
            }
        >
            <View className="flex-1 justify-center items-center w-full">
                <View className="flex-1 justify-between">
                    {/* Profil utilisateur */}
                    <UserProfileCard
                        name={user?.display_name}
                        img={user?.img}
                        totalTracks={totalTracks}
                        provider={user?.provider}
                    />

                    {/* Section principale */}
                    <View className="flex-1 gap-10">
                        <View className="gap-3 w-full">
                            <SectionTitle title="On lance quoi ?" align="left" size='lg' />
                            <CustomButton
                                name={isCreating ? "Création..." : "Créer une partie"}
                                icon="Plus"
                                onPress={handleCreateLobby}
                                variant="white"
                                available={!isCreating}
                                loading={isCreating}
                            />
                            <CustomButton
                                name="Rejoindre une partie"
                                icon="Users"
                                onPress={handleOpenJoinModal}
                                variant="dark"
                            />
                        </View>

                        <View className="gap-3 w-full">
                            <SectionTitle
                                title="Pas de musique ?"
                                align="left"
                                size='lg'
                                subtitle="On s'en occupe !"
                            />
                            <CustomButton
                                name="Choisir mes musiques"
                                icon="Search"
                                onPress={() => { }}
                                variant="white"
                                available={false}
                            />
                        </View>
                    </View>
                </View>

                {/* Barre de navigation du bas */}
                <View className="flex-row gap-6">
                    <IconButton
                        icon="Settings"
                        onPress={() => console.log('Paramètres')}
                        variant="white"
                    />
                    <IconButton
                        icon="LogOut"
                        onPress={confirmLogout}
                        variant="white"
                        color={COLORS.disconnect}
                    />
                </View>

                <JoinLobbyModal
                    visible={isJoinModalVisible}
                    onClose={() => setIsJoinModalVisible(false)}
                    onConfirm={handleJoinLobby}
                    error={joinError}
                    onCodeChange={() => setJoinError(undefined)}
                    isSubmitting={isJoining}
                />
            </View>
        </ScreenLayout>
    )
}
