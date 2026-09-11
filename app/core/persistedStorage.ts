import AsyncStorage from '@react-native-async-storage/async-storage';
import { createJSONStorage } from 'zustand/middleware';

// backend commun aux stores persistés (auth.store, tracks.store) : AsyncStorage
// s'appuie sur localStorage sur web et sur un stockage natif (fichier / base
// SQLite selon la plateforme) sur iOS/Android — dans les deux cas, propre à
// cet appareil/navigateur, jamais partagé entre joueurs
export const persistedStorage = createJSONStorage(() => AsyncStorage);
