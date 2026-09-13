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

// Deezer authentifie par paramètre `access_token` dans l'URL, pas par header Authorization comme Spotify.
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

// Deezer répond toujours en 200, même quand ça échoue (token invalide,
// quota dépassé...) : l'erreur est dans le corps de la réponse, pas dans
// le statut HTTP. le code 300 veut dire "token invalide" chez Deezer.
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
