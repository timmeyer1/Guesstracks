import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { TrackType } from "../core/types";
import { persistedStorage } from '../core/persistedStorage';

type TrackStoreType = {
    likedTracks: TrackType[];
    setLikedTracks: (tracks: TrackType[]) => void;
    setTotalTracks: (totalTracks: number) => void;
    totalTracks: number;
};

// persisté avec auth.store (cf. persistedStorage.ts) : likedTracks n'est
// rempli qu'une fois, à la connexion (cf. login.screen.tsx, finalizeLogin) et
// jamais rechargé depuis une API ensuite — sans persistance, une session
// restaurée après redémarrage de l'app aurait un utilisateur "connecté" mais
// 0 titre à soumettre au lobby (cf. game.service.ts, submitMyTracks)
export const useTrackStore = create<TrackStoreType>()(
    persist(
        (set) => ({
            likedTracks: [],
            setLikedTracks: (tracks) => set({ likedTracks: tracks }),
            setTotalTracks: (totalTracks) => set({ totalTracks: totalTracks }),
            totalTracks: 0
        }),
        {
            name: 'guesstracks-tracks',
            storage: persistedStorage,
        }
    )
);
