import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { persistedStorage } from '../core/persistedStorage';

type AuthStore = {
    token: string | null;
    isAuthenticated: boolean;
    // sépare le token (nécessaire dès que possible pour les appels API,
    // cf. l'intercepteur de app/core/api/client.ts) de isAuthenticated (qui
    // pilote la navigation dans app/navigation/Navigator.tsx) : le login doit
    // pouvoir poser le token puis encore effectuer des appels authentifiés
    // avant de considérer l'utilisateur "prêt" et de basculer d'écran
    setToken: (token: string | null) => void;
    setAuthenticated: (value: boolean) => void;
    logout: () => void;
    user: {
        display_name: string;
        id: string;
        email: string;
        img: string | null;
        account_type: string;
        provider: 'spotify' | 'deezer' | 'csv';
    } | null;
    setUser: (user: {
        display_name: string;
        id: string;
        email: string;
        img: string | null;
        account_type: string;
        provider: 'spotify' | 'deezer' | 'csv';
    }) => void;
};

// persisté (cf. persistedStorage.ts) pour que l'utilisateur retrouve sa
// session (moyen de connexion, profil) d'une visite à l'autre sans avoir à se
// reconnecter — le token Spotify expiré (1h) n'est pas géré ici : l'intercepteur
// 401 d'apiClient (cf. core/api/client.ts) appelle déjà logout() tout seul
// dès le premier appel API qui échoue, ce qui renvoie proprement vers l'écran
// de connexion (cf. Navigator.tsx, isAuthenticated)
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