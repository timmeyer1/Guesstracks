import axios from 'axios'
import { API_TIMEOUT, LOBBY_SERVER_URL } from '../constants'
import { useLobbyStore } from '../../stores/lobby.store'

export const lobbyApiClient = axios.create({
    baseURL: `${LOBBY_SERVER_URL}/api`,
    timeout: API_TIMEOUT,
    headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
    },
})

// le jeton de lobby n'existe qu'une fois dans un lobby (créé/rejoint) : relu
// depuis le store à chaque requête plutôt que figé une fois, même pattern que
// apiClient (cf. app/core/api/client.ts). Absent pour create/join (aucun
// lobby encore rejoint) : le serveur ne l'exige d'ailleurs pas sur ces routes.
lobbyApiClient.interceptors.request.use((config) => {
    const token = useLobbyStore.getState().lobbyToken
    if (token) {
        config.headers.Authorization = `Bearer ${token}`
    }
    return config
})

export const extractLobbyErrorMessage = (error: unknown): string => {
    if (axios.isAxiosError(error)) {
        const serverMessage = error.response?.data?.error
        if (typeof serverMessage === 'string') return serverMessage
        if (error.code === 'ECONNABORTED' || !error.response) {
            return 'Impossible de joindre le serveur de jeu'
        }
    }
    return "Une erreur inattendue s'est produite"
}
