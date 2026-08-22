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

const startWatchingLobby = (code: string, token: string) => {
    unsubscribeSocket?.()
    unsubscribeSocket = subscribeToLobby(code, token, {
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

    // se désabonner avant l'appel réseau : sinon le lobby:update que le
    // serveur diffuse suite à notre propre départ peut être reçu ici avant la
    // réponse de la requête, ce qui fait croire à tort à une expulsion (cf.
    // lobby.screen.tsx, qui affiche "Expulsé" dès qu'on disparaît de `users`)
    stopWatchingLobby()

    try {
        // l'identité (playerId) est portée par le jeton de lobby, ajouté en
        // header par l'intercepteur (cf. app/core/api/lobby.client.ts) — plus
        // besoin de l'envoyer dans le corps de la requête
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
        // requesterId n'est plus envoyé : le serveur l'établit lui-même à
        // partir du jeton de lobby (header Authorization), seule preuve
        // acceptée de "qui appelle cette route"
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
