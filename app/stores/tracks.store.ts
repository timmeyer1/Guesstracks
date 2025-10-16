import { create } from 'zustand';
import {TrackType} from "../core/types";

type TrackStoreType = {
    likedTracks: TrackType[];
    setLikedTracks: (tracks: TrackType[]) => void;
    setTotalTracks: (totalTracks: number) => void;
    totalTracks: number;
};

export const TrackStore = create<TrackStoreType>((set) => ({
    likedTracks: [],
    setLikedTracks: (tracks) => set({ likedTracks: tracks }),
    setTotalTracks: (totalTracks) => set({ totalTracks: totalTracks }),
    totalTracks:0
}));