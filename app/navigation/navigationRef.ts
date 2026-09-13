import { createNavigationContainerRef } from '@react-navigation/native';
import type { RootStackParamList } from './Navigator';

// pour naviguer depuis en dehors d'un composant React, en gros quand
// le serveur ferme le lobby alors que le joueur est sur un autre écran
export const navigationRef = createNavigationContainerRef<RootStackParamList>();

export const resetToHome = () => {
    if (!navigationRef.isReady()) return;
    navigationRef.reset({ index: 0, routes: [{ name: 'Home' }] });
};
