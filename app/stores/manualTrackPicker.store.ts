import { create } from 'zustand';
import type { TrackType } from '../core/types';

type ManualTrackPickerStore = {
    result: TrackType[] | null;
    setResult: (tracks: TrackType[]) => void;
    clear: () => void;
};

// pont temporaire entre ManualTrackPickerScreen et LoginScreen (resté monté
// en dessous). React Navigation a pas de "retour avec résultat", dcp on
// passe par un store au lieu d'un callback onConfirm classique.
export const useManualTrackPickerStore = create<ManualTrackPickerStore>((set) => ({
    result: null,
    setResult: (tracks) => set({ result: tracks }),
    clear: () => set({ result: null }),
}));
