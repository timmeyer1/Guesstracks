import React from 'react'
import {View, Text, Image, FlatList, Button, Alert} from 'react-native'
import {useLobbyStore} from "../stores/lobby.store";
import {useAuthStore} from "../stores/auth.store";
import {useNavigation} from "@react-navigation/native";
import {lobbyScreenStyle} from "./styles/lobby.style";
import {CustomButton} from "../components/Button";
import {createLobby} from "../modules/lobby/lobby.service";

const LobbyScreen = () => {
    const { lobby, users, resetLobby } = useLobbyStore()
    const { user } = useAuthStore()
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
                      text: "Revenir au menu principal",
                      onPress: () => {
                          resetLobby()
                          navigation.navigate('Home')

                      },
                      style: "destructive"
                    },
                    {
                        text: "Annuler",
                        style: "cancel",
                    },
                ]
            );
            return;
        }
    }

    if (!lobby) {
        return (
            <View style={lobbyScreenStyle.container}>
                <Text style={lobbyScreenStyle.title}>Aucun lobby actif 😕</Text>
                <Text style={lobbyScreenStyle.subtitle}>
                    Crée un lobby depuis l’accueil pour commencer.
                </Text>
            </View>
        )
    }

    return (
        <View style={lobbyScreenStyle.container}>
            <Text style={lobbyScreenStyle.title}>{lobby.name}</Text>
            <Text style={lobbyScreenStyle.info}>
                {lobby.nb_player}/{lobby.max_player} joueurs
            </Text>

            <FlatList
                data={users}
                keyExtractor={(item) => item.token}
                renderItem={({ item }) => (
                    <View style={lobbyScreenStyle.userCard}>
                        <Image
                            source={{ uri: item.img || 'https://i.pravatar.cc/100' }}
                            style={lobbyScreenStyle.avatar}
                        />
                        <View>
                            <Text style={lobbyScreenStyle.userName}>{item.name}</Text>
                            <Text style={lobbyScreenStyle.userType}>{item.account_type}</Text>
                        </View>
                    </View>
                )}
                ListEmptyComponent={
                    <Text style={lobbyScreenStyle.emptyText}>Aucun joueur pour le moment</Text>
                }
            />

            <View style={lobbyScreenStyle.footer}>
                <CustomButton
                    name={'Quitter le lobby'}
                    onPress={
                    () => {handleLeaveLobby()}}
                    icon="arrow-right-from-bracket"
                    className="bg-red-500"
                />
            </View>
        </View>
    )
}

export default LobbyScreen


