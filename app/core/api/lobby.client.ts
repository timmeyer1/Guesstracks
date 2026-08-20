import axios from 'axios'
import { API_TIMEOUT, LOBBY_SERVER_URL } from '../constants'

export const lobbyApiClient = axios.create({
    baseURL: `${LOBBY_SERVER_URL}/api`,
    timeout: API_TIMEOUT,
    headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
    },
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
