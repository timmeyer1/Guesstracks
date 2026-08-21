import { Alert } from "react-native"
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

const startWatchingLobby = (code: string) => {
    unsubscribeSocket?.()
    unsubscribeSocket = subscribeToLobby(code, {
        onUpdate: (serverLobby) => applyServerLobby(serverLobby as ServerLobby),
        // ne se déclenche jamais pour un départ volontaire (leaveLobby se
        // désabonne avant l'appel réseau, cf. plus bas) : ce n'est donc reçu
        // que quand le lobby a été vidé par quelqu'un/quelque chose d'autre —
        // en pratique, uniquement quand tout le monde a été expulsé pour
        // inactivité (cf. handleReturnTimeout côté serveur). Sans redirection
        // ici, l'utilisateur restait bloqué sur son écran courant (souvent les
        // résultats de partie) avec un lobby devenu invalide sous ses pieds.
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
        const { data } = await lobbyApiClient.post<{ lobby: ServerLobby }>('/lobbies', { player })
        applyServerLobby(data.lobby)
        startWatchingLobby(data.lobby.code)
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
        const { data } = await lobbyApiClient.post<{ lobby: ServerLobby }>(
            `/lobbies/${code.toUpperCase()}/join`,
            { player }
        )
        applyServerLobby(data.lobby)
        startWatchingLobby(data.lobby.code)
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

    // se désabonner avant l'appel réseau : sinon le lobby:update que le
    // serveur diffuse suite à notre propre départ peut être reçu ici avant la
    // réponse de la requête, ce qui fait croire à tort à une expulsion (cf.
    // lobby.screen.tsx, qui affiche "Expulsé" dès qu'on disparaît de `users`)
    stopWatchingLobby()

    try {
        await lobbyApiClient.post(`/lobbies/${lobby.code}/leave`, { playerId: user.id })
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
        const { data } = await lobbyApiClient.post<{ lobby: ServerLobby }>(`/lobbies/${lobby.code}/kick`, {
            requesterId: user.id,
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
            requesterId: user.id,
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
}): Promise<LobbyResult> => {
    const { user } = useAuthStore.getState()
    const { lobby } = useLobbyStore.getState()

    if (!user || !lobby) {
        return { ok: false, error: 'Aucun lobby actif' }
    }

    try {
        const { data } = await lobbyApiClient.patch<{ lobby: ServerLobby }>(
            `/lobbies/${lobby.code}/settings`,
            { playerId: user.id, ...settings }
        )
        applyServerLobby(data.lobby)
        return { ok: true }
    } catch (error) {
        return { ok: false, error: extractLobbyErrorMessage(error) }
    }
}
