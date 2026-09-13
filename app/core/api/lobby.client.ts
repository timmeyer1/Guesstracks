import axios from 'axios'
import { API_TIMEOUT, LOBBY_SERVER_URL } from '../constants'
import { useLobbyStore } from '../../stores/lobby.store'

export const lobbyApiClient = axios.create({
    baseURL: `${LOBBY_SERVER_URL}/api`,
    timeout: API_TIMEOUT,
    headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        // sans ce header, un tunnel ngrok gratuit renvoie une page d'avertissement
        // au lieu de faire passer la requête. sans incidence si y'a pas de
        // ngrok, le header est juste ignoré.
        'ngrok-skip-browser-warning': 'true',
    },
})

// le jeton de lobby n'existe qu'une fois qu'on a créé ou rejoint un lobby,
// dcp on va le chercher dans le store à chaque requête (même principe que
// apiClient). il est absent pour create/join, et le serveur ne l'exige
// pas sur ces routes-là.
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
