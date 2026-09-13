import AsyncStorage from '@react-native-async-storage/async-storage';
import { createJSONStorage } from 'zustand/middleware';

// Stockage commun aux stores persistés (auth, tracks). Propre à chaque appareil, jamais partagé entre joueurs.
export const persistedStorage = createJSONStorage(() => AsyncStorage);
