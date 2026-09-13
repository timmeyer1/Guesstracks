// en mode cet import doit être en premier, avant tout le reste (même expo),
// sinon certains Android ratent l'enregistrement des handlers natifs
import 'react-native-gesture-handler';

import { registerRootComponent } from 'expo';

import App from './App';

// enregistre App comme composant racine, que ce soit dans Expo Go ou en build natif
registerRootComponent(App);
