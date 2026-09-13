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

// persisté comme auth.store : likedTracks est rempli une seule fois à la
// connexion, jamais rechargé après. Sans ça, un utilisateur qui rouvre l'app
// serait "connecté" mais avec 0 titre à envoyer au lobby.
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
