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
        name: `${user.display_name}`,
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
    const { users, resetLobby, removeUser, setUsers } = useLobbyStore.getState()

    if (!user || !token) {
        console.warn('❌ Utilisateur non connecté')
        return { shouldNavigate: false }
    }

    const isHost = users[0]?.token === token

    // CAS 1 : hote seul = supprime lobby
    if (isHost && users.length === 1) {
        resetLobby()
        console.log('🗑️ Lobby supprimé (hôte seul)')
        return { shouldNavigate: true }
    }

    // CAS 2 : hote avec joueurs = transfère l'hôte
    if (isHost && users.length > 1) {
        const newUsers = users.slice(1) // retire l'hôte actuel
        setUsers(newUsers)
        console.log('👑 Nouvel hôte:', newUsers[0].name)
        return { shouldNavigate: true }
    }

    // CAS 3 : joueur normal = retire juste du lobby
    removeUser(token)
    console.log('👋 Joueur retiré')
    return { shouldNavigate: true }
}