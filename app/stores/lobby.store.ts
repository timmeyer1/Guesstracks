import { create } from 'zustand'
import { LobbyType, LobbyUserType } from "../core/types"

type LobbyStoreType = {
    users: LobbyUserType[]
    lobby: LobbyType | null
    // jeton de session émis par le serveur à la création/l'entrée dans le
    // lobby, prouvant que ce joueur est bien celui qu'il prétend être (cf.
    // app/core/api/lobby.client.ts et app/core/socket.ts) — jamais un
    // playerId envoyé nu, falsifiable par n'importe quel client
    lobbyToken: string | null

    // le serveur est la source de vérité : ces setters remplacent l'état
    // complet à chaque mise à jour reçue (création, join, socket, ...)
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