import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { persistedStorage } from '../core/persistedStorage';

type AuthStore = {
    token: string | null;
    isAuthenticated: boolean;
    // le token et isAuthenticated sont séparés en gros pour pouvoir poser le
    // token et faire des appels API avant de basculer l'écran de connexion
    setToken: (token: string | null) => void;
    setAuthenticated: (value: boolean) => void;
    logout: () => void;
    user: {
        display_name: string;
        id: string;
        email: string;
        img: string | null;
        account_type: string;
        provider: 'spotify' | 'deezer' | 'csv' | 'manual';
    } | null;
    setUser: (user: {
        display_name: string;
        id: string;
        email: string;
        img: string | null;
        account_type: string;
        provider: 'spotify' | 'deezer' | 'csv' | 'manual';
    }) => void;
};

// persisté dcp l'utilisateur retrouve sa session sans se reconnecter à chaque
// fois. Le token Spotify expiré (1h) est pas géré ici, c'est l'intercepteur
// 401 du client API qui appelle logout() tout seul quand ça arrive.
export const useAuthStore = create<AuthStore>()(
    persist(
        (set) => ({
            token: null,
            isAuthenticated: false,
            setToken: (token) => set({ token }),
            setAuthenticated: (value) => set({ isAuthenticated: value }),
            logout: () => set({ token: null, isAuthenticated: false, user: null }),
            user: null,
            setUser: (user) => set({ user }),
        }),
        {
            name: 'guesstracks-auth',
            storage: persistedStorage,
            partialize: (state) => ({
                token: state.token,
                isAuthenticated: state.isAuthenticated,
                user: state.user,
            }),
        }
    )
);