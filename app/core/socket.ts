import { io, Socket } from 'socket.io-client'
import { LOBBY_SERVER_URL } from './constants'

let socket: Socket | null = null

const getSocket = (): Socket => {
    if (!socket) {
        socket = io(LOBBY_SERVER_URL, {
            transports: ['websocket'],
            autoConnect: true,
        })
    }
    return socket
}

export const subscribeToLobby = (
    code: string,
    handlers: { onUpdate: (lobby: unknown) => void; onClosed: () => void }
) => {
    const s = getSocket()
    s.emit('lobby:subscribe', code)
    s.on('lobby:update', handlers.onUpdate)
    s.on('lobby:closed', handlers.onClosed)

    return () => {
        s.off('lobby:update', handlers.onUpdate)
        s.off('lobby:closed', handlers.onClosed)
        s.emit('lobby:unsubscribe', code)
    }
}
