import { useEffect } from 'react';
import { View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import './global.css';
import { AuthNavigator } from './app/navigation/Navigator';
import {SafeAreaProvider} from "react-native-safe-area-context";
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { setAudioModeAsync } from 'expo-audio';
import { ErrorBoundary } from './app/components/ErrorBoundary';
import { StandaloneGate } from './app/components/StandaloneGate';
import { LoadingSpinner } from './app/components/LoadingSpinner';
import { setupWebAudioUnlock } from './app/core/webAudioUnlock';
import { useRobustKeepAwake } from './app/core/hooks/useRobustKeepAwake';
import { useStoresHydrated } from './app/core/hooks/useStoresHydrated';


export default function App() {
  // empêche l'écran de s'éteindre pour inactivité tant que l'app reste
  // ouverte (accueil, lobby, partie...), pas seulement pendant une manche —
  // demandé explicitement : rien de pire que l'écran qui s'éteint en
  // attendant les autres joueurs dans le lobby. cf. useRobustKeepAwake.ts
  // pour pourquoi le hook `useKeepAwake()` d'expo-keep-awake seul ne
  // suffisait pas sur web (confirmé en conditions réelles, iPhone ET
  // Android : l'écran finissait quand même par s'éteindre).
  useRobustKeepAwake();

  // tant que la session persistée (cf. useStoresHydrated) n'a pas fini
  // d'être relue depuis le stockage local, isAuthenticated vaut encore false
  // par défaut : rendre AuthNavigator avant ça ferait flasher l'écran de
  // connexion même pour un utilisateur déjà connecté
  const storesHydrated = useStoresHydrated();

  // rien n'était configuré ici jusqu'à présent : le mode audio par défaut
  // d'expo-audio peut, sur Android, refuser silencieusement le focus audio
  // (donc ne pas jouer le son) selon l'état du téléphone (notification en
  // cours, autre appli musique en pause qui garde la main...), sans qu'aucune
  // erreur ne remonte côté JS (expo-audio n'expose pas d'erreur de lecture,
  // cf. useSyncedAudioPlayer.ts) — signalé comme "pas de son du tout sur
  // certains extraits, marche sur iPhone" par des joueurs Android.
  // `duckOthers` demande le focus sans l'exiger en exclusivité (contrairement
  // au réglage par défaut, plus strict), ce qui réduit les cas où Android
  // refuse de l'accorder plutôt que de simplement baisser le son des autres.
  // Web uniquement (no-op ailleurs, cf. la fonction elle-même) : sans ça, les
  // extraits ne se lancent jamais tout seuls sur web (cf. useSyncedAudioPlayer,
  // dont tous les play() partent d'un timer, jamais d'un clic direct).
  useEffect(() => {
    setupWebAudioUnlock()
  }, []);

  useEffect(() => {
    setAudioModeAsync({
      playsInSilentMode: true,
      interruptionMode: 'duckOthers',
      shouldPlayInBackground: false,
    }).catch((err) => {
      console.error('❌ Échec de la configuration du mode audio :', err);
    });
  }, []);

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