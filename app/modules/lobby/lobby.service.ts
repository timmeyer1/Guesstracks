import { nanoid } from 'nanoid/non-secure'
import { useAuthStore } from "../../stores/auth.store"
import { useLobbyStore } from "../../stores/lobby.store"
import { DEFAULT_LOBBY_SETTINGS } from "../../core/constants/lobby.constants"

export const createLobby = () => {
    const { user, token } = useAuthStore.getState()
    const { setLobby, addUser } = useLobbyStore.getState()

    if (!user || !token) {
        console.warn('❌ Utilisateur non connecté')
        return
    }

    const newLobby = {
        token: nanoid(10),
        name: `Lobby de ${user.display_name}`,
        nb_player: 1,
        max_player: DEFAULT_LOBBY_SETTINGS.maxPlayers,
        gameMode: DEFAULT_LOBBY_SETTINGS.gameMode,
        rounds: DEFAULT_LOBBY_SETTINGS.rounds,
        phaseSpeed: DEFAULT_LOBBY_SETTINGS.phaseSpeed,
    }

    setLobby(newLobby)
    addUser({
        token,
        name: user.display_name,
        img: user.img || "",
        account_type: user.account_type,
    })

    console.log('✅ Lobby créé:', newLobby)
}

export const leaveLobby = () => {
    const { user, token } = useAuthStore.getState()
    const { users, resetLobby, removeUser } = useLobbyStore.getState()

    if (!user || !token) {
        console.warn('❌ Utilisateur non connecté')
        return false
    }

    // si c'est le dernier joueur → supprime le lobby
    if (users.length <= 1) {
        resetLobby()
        console.log('🗑️ Lobby supprimé')
        return true
    }

    // sinon, retire juste le joueur
    removeUser(token)
    console.log('👋 Joueur retiré')
    return false
}