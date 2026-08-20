import { create } from 'zustand'
import { LobbyType, LobbyUserType } from "../core/types"

type LobbyStoreType = {
    users: LobbyUserType[]
    lobby: LobbyType | null

    // le serveur est la source de vérité : ces setters remplacent l'état
    // complet à chaque mise à jour reçue (création, join, socket, ...)
    setUsers: (users: LobbyUserType[]) => void
    setLobby: (lobby: LobbyType) => void
    resetLobby: () => void
}

export const useLobbyStore = create<LobbyStoreType>((set) => ({
    users: [],
    lobby: null,

    setUsers: (users) => set({ users }),
    setLobby: (lobby) => set({ lobby }),

    // reset tout
    resetLobby: () => set({ lobby: null, users: [] }),
}))