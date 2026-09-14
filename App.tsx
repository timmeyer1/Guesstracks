import { useEffect } from 'react';
import { View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import './global.css';
import { AuthNavigator } from './app/navigation/Navigator';
import {SafeAreaProvider} from "react-native-safe-area-context";
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { ErrorBoundary } from './app/components/ErrorBoundary';
import { StandaloneGate } from './app/components/StandaloneGate';
import { LoadingSpinner } from './app/components/LoadingSpinner';
import { setupWebAudioUnlock } from './app/core/webAudioUnlock';
import { useRobustKeepAwake } from './app/core/hooks/useRobustKeepAwake';
import { useStoresHydrated } from './app/core/hooks/useStoresHydrated';
import { useAudioModeSetup } from './app/core/hooks/useAudioModeSetup';


export default function App() {
  // en mode l'écran doit pas s'éteindre tout seul, même en attendant
  // les autres dans le lobby. Le hook natif d'expo tout seul suffisait
  // pas (testé sur iPhone et Android), dcp voir useRobustKeepAwake.ts.
  useRobustKeepAwake();

  // en attendant que la session sauvegardée soit relue, on affiche pas
  // le navigateur direct sinon ça flash l'écran de connexion en gros.
  const storesHydrated = useStoresHydrated();

  // sur Android le son peut être coupé en silence sans erreur (notif,
  // autre appli musique...), du coup certains joueurs avaient pas de son
  // du tout. `duckOthers` évite qu'Android refuse le focus audio direct.
  // Web only, sinon les extraits se lancent jamais tout seuls là-bas.
  useEffect(() => {
    setupWebAudioUnlock()
  }, []);

  // Réapplique la config audio (ignorer le silencieux, etc.) à chaque
  // retour au premier plan, pas juste au lancement — voir useAudioModeSetup.
  useAudioModeSetup();

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ErrorBoundary>
          <StandaloneGate>
            {storesHydrated ? (
              <AuthNavigator />
            ) : (
              <View className="flex-1 items-center justify-center bg-gray-50">
                <LoadingSpinner size={32} />
              </View>
            )}
          </StandaloneGate>
        </ErrorBoundary>
        <StatusBar style="dark" />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}