import axios from 'axios';
import { API_TIMEOUT, DEEZER_BASE_URL } from '../constants';
import { useAuthStore } from '../../stores/auth.store';

export const deezerApiClient = axios.create({
    baseURL: DEEZER_BASE_URL,
    timeout: API_TIMEOUT || 10000,
    headers: {
        Accept: 'application/json',
    },
});

// Deezer authentifie par paramètre de requête `access_token`, pas par header
// Authorization (cf. app/core/api/client.ts pour l'équivalent Spotify)
deezerApiClient.interceptors.request.use(
    (config) => {
        const token = useAuthStore.getState().token;
        if (token) {
            config.params = { ...config.params, access_token: token };
        }
        return config;
    },
    (error) => Promise.reject(error)
);

// Deezer répond en HTTP 200 même en cas d'échec (token invalide, quota,
// etc.), avec un corps `{ error: { type, message, code } }` : il n'y a donc
// pas de statut HTTP à intercepter comme le 401 de Spotify. code 300 =
// "Invalid token" côté Deezer.
deezerApiClient.interceptors.response.use(
    (response) => {
        if (response.data?.error?.code === 300) {
            console.warn('⚠️ Token Deezer expiré ou invalide');
            useAuthStore.getState().logout();
        }
        return response;
    },
    (error) => {
        if (error.response?.status >= 500) {
            console.error('Server error:', error.response.status, error.message);
        }
        return Promise.reject(error);
    }
);
