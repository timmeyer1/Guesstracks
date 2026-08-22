// doit être le tout premier import (avant tout le reste, y compris expo) :
// react-native-gesture-handler enregistre ses handlers natifs au chargement,
// et un import tardif peut les faire rater sur certains appareils Android
import 'react-native-gesture-handler';

import { registerRootComponent } from 'expo';

import App from './App';

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
