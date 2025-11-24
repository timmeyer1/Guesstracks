import { create } from 'zustand'
import { LobbyType, LobbyUserType } from "../core/types"

type LobbyStoreType = {
    users: LobbyUserType[]
    lobby: LobbyType | null

    // actions sur les utilisateurs
    setUsers: (users: LobbyUserType[]) => void
    addUser: (user: LobbyUserType) => void
    removeUser: (userToken: string) => void

    // actions sur le lobby
    setLobby: (lobby: LobbyType) => void
    updateLobbySettings: (settings: Partial<Pick<LobbyType, 'rounds' | 'phaseSpeed' | 'gameMode'>>) => void
    resetLobby: () => void
}

export const useLobbyStore = create<LobbyStoreType>((set) => ({
    users: [],
    lobby: null,

    // remplace tous les utilisateurs
    setUsers: (users) => set({ users }),

    // ajoute un utilisateur + met à jour le compteur
    addUser: (user) => set((state) => {
        const newUsers = [...state.users, user]
        return {
            users: newUsers,
            lobby: state.lobby ? { ...state.lobby, nb_player: newUsers.length } : null
        }
    }),

    // retire un utilisateur + met à jour le compteur
    removeUser: (userToken) => set((state) => {
        const newUsers = state.users.filter(u => u.token !== userToken)
        return {
            users: newUsers,
            lobby: state.lobby ? { ...state.lobby, nb_player: newUsers.length } : null
        }
    }),

    // crée/remplace le lobby
    setLobby: (lobby) => set({ lobby }),

    // met à jour uniquement certains paramètres du lobby
    updateLobbySettings: (settings) => set((state) => ({
        lobby: state.lobby ? { ...state.lobby, ...settings } : null
    })),

    // reset tout
    resetLobby: () => set({ lobby: null, users: [] }),
}))