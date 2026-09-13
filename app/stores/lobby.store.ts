import { create } from 'zustand'
import { LobbyType, LobbyUserType } from "../core/types"

type LobbyStoreType = {
    users: LobbyUserType[]
    lobby: LobbyType | null
    // jeton donné par le serveur qui prouve que t'es bien le joueur que tu prétends être,
    // dcp jamais un playerId tout nu qui pourrait être falsifié
    lobbyToken: string | null

    // le serveur est la source de vérité, ces setters remplacent tout l'état à chaque update
    setUsers: (users: LobbyUserType[]) => void
    setLobby: (lobby: LobbyType) => void
    setLobbyToken: (token: string | null) => void
    resetLobby: () => void
}

export const useLobbyStore = create<LobbyStoreType>((set) => ({
    users: [],
    lobby: null,
    lobbyToken: null,

    setUsers: (users) => set({ users }),
    setLobby: (lobby) => set({ lobby }),
    setLobbyToken: (lobbyToken) => set({ lobbyToken }),

    // reset tout
    resetLobby: () => set({ lobby: null, users: [], lobbyToken: null }),
}))