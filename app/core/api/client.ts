import axios from 'axios';
import {API_TIMEOUT, SPOTIFY_BASE_URL} from '../constants';
import {useAuthStore} from "../../stores/auth.store";

export const apiClient = axios.create({
    baseURL: SPOTIFY_BASE_URL, // à adapter selon le module
    timeout: API_TIMEOUT || 10000,
    headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
    },
});

// au moment où apiClient est créé, on n'a pas encore le token (avant tout
// login). dcp on va le rechercher dans le store à chaque requête, plutôt
// que de le figer une fois pour toutes dans les headers.
apiClient.interceptors.request.use(
    async (config) => {
        try {
            const token = useAuthStore.getState().token;
            if (token) {
                config.headers.Authorization = `Bearer ${token}`;
            }
            return config;
        } catch (error) {
            console.error(' Request error:', error);
            return Promise.reject(error);
        }
    },
    (error) => Promise.reject(error)
);

apiClient.interceptors.response.use(
    (response) => response,
    async (error) => {
        const status = error.response?.status;

        if (status === 401) {
            console.warn('⚠Token expiré ou invalide');
            const { logout } = useAuthStore.getState();
            logout();
        }

        if (status >= 500) {
            console.error('Server error:', status, error.message);
        }

        return Promise.reject(error);
    }
);
