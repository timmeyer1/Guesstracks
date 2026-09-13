import { Alert } from "../../core/alert"
import { useAuthStore } from "../../stores/auth.store"
import { useLobbyStore } from "../../stores/lobby.store"
import { lobbyApiClient, extractLobbyErrorMessage } from "../../core/api/lobby.client"
import { subscribeToLobby } from "../../core/socket"
import { resetToHome } from "../../navigation/navigationRef"
import { leaveGame } from "../game/game.service"
import type { LobbyType, LobbyUserType } from "../../core/types"

type ServerPlayer = {
    id: string
    name: string
    img: string | null
    accountType: string | null
}

type ServerLobby = {
    code: string
    name: string
    gameMode: LobbyType['gameMode']
    rounds: number
    phaseSpeed: LobbyType['phaseSpeed']
    manualAdvance: boolean
    settingsConfirmed: boolean
    maxPlayers: number
    players: ServerPlayer[]
}

type LobbyResult = { ok: true } | { ok: false; error: string }

let unsubscribeSocket: (() => void) | null = null

const toLobbyUser = (player: ServerPlayer): LobbyUserType => ({
    id: player.id,
    name: player.name,
    img: player.img ?? undefined,
    account_type: player.accountType ?? undefined,
})

const applyServerLobby = (serverLobby: ServerLobby) => {
    const { setLobby, setUsers } = useLobbyStore.getState()
    setLobby({
        code: serverLobby.code,
        name: serverLobby.name,
        nb_player: serverLobby.players.length,
        max_player: serverLobby.maxPlayers,
        gameMode: serverLobby.gameMode,
        rounds: serverLobby.rounds,
        phaseSpeed: serverLobby.phaseSpeed,
        manualAdvance: serverLobby.manualAdvance,
        settingsConfirmed: serverLobby.settingsConfirmed,
    })
    setUsers(serverLobby.players.map(toLobbyUser))
}

const buildPlayerPayload = () => {
    const { user } = useAuthStore.getState()
    if (!user) return null
    return {
        id: user.id,
        name: user.display_name,
        img: user.img || null,
        accountType: user.account_type || null,
    }
}

const startWatchingLobby = (code: string, token: string) => {
    unsubscribeSocket?.()
    unsubscribeSocket = subscribeToLobby(code, token, {
        onUpdate: (serverLobby) => applyServerLobby(serverLobby as ServerLobby),
        // se déclenche jamais quand on part nous-même (voir leaveLobby plus
        // bas). En vrai ça arrive que quand tout le monde a été expulsé pour
        // inactivité — sans ce redirect, on restait coincé sur un écran avec
        // un lobby qui n'existe plus
        onClosed: () => {
            useLobbyStore.getState().resetLobby()
            leaveGame()
            unsubscribeSocket?.()
            unsubscribeSocket = null
            Alert.alert("Lobby fermé", "Tout le monde a été expulsé du lobby pour inactivité.")
            resetToHome()
        },
    })
}

const stopWatchingLobby = () => {
    unsubscribeSocket?.()
    unsubscribeSocket = null
}

export const createLobby = async (): Promise<LobbyResult> => {
    const player = buildPlayerPayload()
    if (!player) {
        return { ok: false, error: 'Utilisateur non connecté' }
    }

    try {
        const { data } = await lobbyApiClient.post<{ lobby: ServerLobby; token: string }>('/lobbies', { player })
        useLobbyStore.getState().setLobbyToken(data.token)
        applyServerLobby(data.lobby)
        startWatchingLobby(data.lobby.code, data.token)
        return { ok: true }
    } catch (error) {
        return { ok: false, error: extractLobbyErrorMessage(error) }
    }
}

export const joinLobby = async (code: string): Promise<LobbyResult> => {
    const player = buildPlayerPayload()
    if (!player) {
        return { ok: false, error: 'Utilisateur non connecté' }
    }

    try {
        const { data } = await lobbyApiClient.post<{ lobby: ServerLobby; token: string }>(
            `/lobbies/${code.toUpperCase()}/join`,
            { player }
        )
        useLobbyStore.getState().setLobbyToken(data.token)
        applyServerLobby(data.lobby)
        startWatchingLobby(data.lobby.code, data.token)
        return { ok: true }
    } catch (error) {
        return { ok: false, error: extractLobbyErrorMessage(error) }
    }
}

export const leaveLobby = async (): Promise<{ shouldNavigate: boolean }> => {
    const { user } = useAuthStore.getState()
    const { lobby, resetLobby } = useLobbyStore.getState()

    if (!user || !lobby) {
        return { shouldNavigate: false }
    }

    // se désabonner avant d'appeler le serveur, sinon la mise à jour qu'il
    // renvoie suite à notre départ arrive trop tôt et fait croire à une expulsion
    stopWatchingLobby()

    try {
        // l'identité du joueur passe par le jeton de lobby (ajouté en header
        // automatiquement), pas besoin de la remettre dans la requête
        await lobbyApiClient.post(`/lobbies/${lobby.code}/leave`)
    } catch (error) {
        console.warn('⚠️ Erreur en quittant le lobby:', extractLobbyErrorMessage(error))
    }

    resetLobby()
    return { shouldNavigate: true }
}

export const kickPlayer = async (targetId: string): Promise<LobbyResult> => {
    const { user } = useAuthStore.getState()
    const { lobby } = useLobbyStore.getState()
    if (!user || !lobby) {
        return { ok: false, error: 'Aucun lobby actif' }
    }

    try {
        // pas besoin d'envoyer qui fait la demande, le serveur le sait déjà
        // grâce au jeton de lobby
        const { data } = await lobbyApiClient.post<{ lobby: ServerLobby }>(`/lobbies/${lobby.code}/kick`, {
            targetId,
        })
        applyServerLobby(data.lobby)
        return { ok: true }
    } catch (error) {
        return { ok: false, error: extractLobbyErrorMessage(error) }
    }
}

export const transferHost = async (targetId: string): Promise<LobbyResult> => {
    const { user } = useAuthStore.getState()
    const { lobby } = useLobbyStore.getState()
    if (!user || !lobby) {
        return { ok: false, error: 'Aucun lobby actif' }
    }

    try {
        const { data } = await lobbyApiClient.post<{ lobby: ServerLobby }>(`/lobbies/${lobby.code}/transfer-host`, {
            targetId,
        })
        applyServerLobby(data.lobby)
        return { ok: true }
    } catch (error) {
        return { ok: false, error: extractLobbyErrorMessage(error) }
    }
}

export const updateLobbySettings = async (settings: {
    gameMode: LobbyType['gameMode']
    rounds: number
    phaseSpeed: LobbyType['phaseSpeed']
    manualAdvance: boolean
}): Promise<LobbyResult> => {
    const { user } = useAuthStore.getState()
    const { lobby } = useLobbyStore.getState()

    if (!user || !lobby) {
        return { ok: false, error: 'Aucun lobby actif' }
    }

    try {
        const { data } = await lobbyApiClient.patch<{ lobby: ServerLobby }>(
            `/lobbies/${lobby.code}/settings`,
            settings
        )
        applyServerLobby(data.lobby)
        return { ok: true }
    } catch (error) {
        return { ok: false, error: extractLobbyErrorMessage(error) }
    }
}
