import { create } from 'zustand';

type AuthStore = {
    token: string | null;
    isAuthenticated: boolean;
    setToken: (token: string | null) => void;
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
    setToken: (token) => set({ token, isAuthenticated: !!token }),
    logout: () => set({ token: null, isAuthenticated: false }),
    user: null,
    setUser: (user) => set({ user }),
}));