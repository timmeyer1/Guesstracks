import { create } from 'zustand';

type AuthStore = {
    token: string | null;
    isAuthenticated: boolean;
    setToken: (token: string | null) => void;
    logout: () => void;
};

export const useAuthStore = create<AuthStore>((set) => ({
    token: null,
    isAuthenticated: false,
    setToken: (token) => set({ token, isAuthenticated: !!token }),
    logout: () => set({ token: null, isAuthenticated: false }),
}));