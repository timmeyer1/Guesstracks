import { create } from 'zustand';
import type { TrackType } from '../core/types';

type ManualTrackPickerStore = {
    result: TrackType[] | null;
    setResult: (tracks: TrackType[]) => void;
    clear: () => void;
};

// pont éphémère (jamais persisté) entre ManualTrackPickerScreen et
// LoginScreen, qui reste monté en dessous pendant que cet écran est poussé
// sur la pile (cf. Navigator.tsx) : remplace le callback onConfirm d'une
// modale classique, React Navigation n'offrant pas de mécanisme "retour avec
// résultat" et aucun écran de l'app ne faisant transiter de données par
// route.params — tout passe par un store, même pattern que le reste de
// l'app (cf. auth.store.ts, tracks.store.ts)
export const useManualTrackPickerStore = create<ManualTrackPickerStore>((set) => ({
    result: null,
    setResult: (tracks) => set({ result: tracks }),
    clear: () => set({ result: null }),
}));
