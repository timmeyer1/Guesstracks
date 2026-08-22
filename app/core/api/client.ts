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

// le token n'est jamais connu au moment où apiClient est créé (import-time,
// avant tout login) : il est relu depuis le store à chaque requête plutôt que
// figé une fois dans les headers ci-dessus
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
