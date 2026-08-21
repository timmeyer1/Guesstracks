import { create } from 'zustand';

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
    } | null;
    setUser: (user: { 
        display_name: string; 
        id: string; 
        email: string; 
        img: string | null;
        account_type: string;
    }) => void;
};

export const useAuthStore = create<AuthStore>((set) => ({
    token: null,
    isAuthenticated: false,
    setToken: (token) => set({ token }),
    setAuthenticated: (value) => set({ isAuthenticated: value }),
    logout: () => set({ token: null, isAuthenticated: false }),
    user: null,
    setUser: (user) => set({ user }),
}));