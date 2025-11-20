import { create } from 'zustand'
import { LobbyType, LobbyUserType } from "../core/types";


type LobbyStoreType = {
    users: LobbyUserType[]
    lobby: LobbyType | null
    setUsers: (users: LobbyUserType[]) => void
    addUser: (user: LobbyUserType) => void
    removeUser: (userToken: string) => void
    setLobby: (lobby: LobbyType) => void
    resetLobby: () => void
}

export const useLobbyStore = create<LobbyStoreType>((set) => ({
    users: [],
    lobby: null,

    setUsers: (users) => set({ users }),
    addUser: (user) => set((state) => ({ users: [...state.users, user] })),
    removeUser: (userToken) => set((state) => {
        const newUsers = state.users.filter(u => u.token !== userToken);
        return {
            users: newUsers,
            lobby: state.lobby ? {
                ...state.lobby,
                nb_player: newUsers.length // pour mettre a jour le compteur
            } : null
        };
    }), setLobby: (lobby) => set({ lobby }),
    resetLobby: () => set({ lobby: null, users: [] }),
}))
