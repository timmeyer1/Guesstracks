// app/stores/likedTrack.store.ts
import { create } from 'zustand';
import {TrackType} from "../core/types";

type TrackStoreType = {
    likedTracks: TrackType[];
    setLikedTracks: (tracks: TrackType[]) => void;
    clearTracks: () => void;
};

export const TrackStore = create<TrackStoreType>((set) => ({
    likedTracks: [],
    setLikedTracks: (tracks) => set({ likedTracks: tracks }),
    clearTracks: () => set({ likedTracks: [] }),
}));
