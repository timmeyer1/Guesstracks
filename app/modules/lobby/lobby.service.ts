
import { nanoid } from 'nanoid/non-secure'
import {useAuthStore} from "../../stores/auth.store";
import {useLobbyStore} from "../../stores/lobby.store";

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
        max_player: 4,
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
