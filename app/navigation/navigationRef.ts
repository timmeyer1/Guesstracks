import { createNavigationContainerRef } from '@react-navigation/native';
import type { RootStackParamList } from './Navigator';

// permet de naviguer depuis en dehors d'un composant React (ex:
// lobby.service.ts, quand le lobby est fermé par le serveur pendant que
// l'utilisateur est sur un tout autre écran, comme les résultats de partie)
export const navigationRef = createNavigationContainerRef<RootStackParamList>();

export const resetToHome = () => {
    if (!navigationRef.isReady()) return;
    navigationRef.reset({ index: 0, routes: [{ name: 'Home' }] });
};
