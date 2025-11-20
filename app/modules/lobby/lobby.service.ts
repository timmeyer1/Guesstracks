import { nanoid } from 'nanoid/non-secure'
import {useAuthStore} from "../../stores/auth.store";
import {useLobbyStore} from "../../stores/lobby.store";
import {Alert} from "react-native";

export const createLobby = () => {
    const { user, token } = useAuthStore.getState()
    const { setLobby, addUser } = useLobbyStore.getState()

    if (!user || !token) {
        console.warn('Impossible de créer un lobby : utilisateur non connecté.')
        return
    }

    const newLobby = {
        token: nanoid(10),
        name: ` Lobby de ${user.display_name} `,
        nb_player: 1,
        max_player: 10,
    }

    setLobby(newLobby)
    addUser({
        token,
        name: user.display_name,
        img: user.img || "",
        account_type: user.account_type,
    })

    console.log('Lobby créé:', newLobby)
}

export const leaveLobby = () => {
    const { user, token } = useAuthStore.getState()
    const { users, resetLobby, removeUser } = useLobbyStore.getState()

    if (!user || !token) {
        console.warn('Impossible de quitter : utilisateur non connecté.')
        return false
    }

    // si le dernier joueur quitte, on supprime le lobby
    if (users.length <= 1) {
        resetLobby()
        console.log('🗑️ Lobby supprimé (dernier joueur)')
        return true
    }

    // sinon, on retire l'utilisateur
    removeUser(token)
    console.log('👋 Utilisateur retiré du lobby')
    return false  // false = le lobby existe encore
}