import { create } from 'zustand'
import {LobbyType, LobbyUserType} from "../core/types";


type LobbyStoreType = {
    users: LobbyUserType[]
    lobby: LobbyType | null
    setUsers: (users: LobbyUserType[]) => void
    addUser: (user: LobbyUserType) => void
    setLobby: (lobby: LobbyType) => void
    resetLobby: () => void
}

export const useLobbyStore = create<LobbyStoreType>((set) => ({
    users: [],
    lobby: null,

    setUsers: (users) => set({ users }),
    addUser: (user) => set((state) => ({ users: [...state.users, user] })),
    setLobby: (lobby) => set({ lobby }),
    resetLobby: () => set({ lobby: null, users: [] }),
}))
