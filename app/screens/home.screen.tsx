import { useEffect, useState } from 'react'
import { View, Alert } from 'react-native'
import { useAuthStore } from '../stores/auth.store'
import { TrackStore } from '../stores/tracks.store'
import { spotifyService } from '../modules/spotify'
import { createLobby } from "../modules/lobby/lobby.service"
import { useNavigation } from '@react-navigation/native'
import { COLORS } from '../core/constants/colors.constants'
import { JoinLobbyModal } from '../components/home/JoinLobbyModal'
import { UserProfileCard } from '../components/UserProfileCard'
import { SectionTitle } from '../components/SectionTitle'
import { IconButton } from '../components/IconButton'
import { ScreenLayout } from '../components/ScreenLayout'
import { CustomButton } from '../components/Button'

export const HomeScreen = () => {
    const totalTracks = TrackStore((s) => s.totalTracks)
    const logoutFn = useAuthStore((s) => s.logout)
    const user = useAuthStore((s) => s.user)
    const navigation = useNavigation()

    const [isJoinModalVisible, setIsJoinModalVisible] = useState(false)

    useEffect(() => {
        const loadTracks = async () => {
            try {
                const total = await spotifyService.getTotalTracks()
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

    const handleCreateLobby = () => {
        createLobby()
        navigation.navigate("Lobby")
    }

    const handleJoinLobby = (code: string) => {
        console.log('Code entré:', code)
        // TODO: Logique pour rejoindre le lobby
    }

    return (
        <ScreenLayout>
            <View className="flex-1 justify-center items-center w-full">
                <View className="flex-1 justify-between">
                    {/* Profil utilisateur */}
                    <UserProfileCard
                        name={user?.display_name}
                        img={user?.img}
                        totalTracks={totalTracks}
                    />

                    {/* Section principale */}
                    <View className="flex-1 gap-10">
                        <View className="gap-3 w-full">
                            <SectionTitle title="On lance quoi ?" align="left" size='lg' />
                            <CustomButton
                                name="Créer une partie"
                                icon="Plus"
                                onPress={handleCreateLobby}
                                variant="white"
                            />
                            <CustomButton
                                name="Rejoindre une partie"
                                icon="Users"
                                onPress={() => setIsJoinModalVisible(true)}
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
                                onPress={() => setIsJoinModalVisible(true)}
                                variant="white"
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
                />
            </View>
        </ScreenLayout>
    )
}