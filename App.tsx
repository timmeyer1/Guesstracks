import { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import './global.css';
import { AuthNavigator } from './app/navigation/Navigator';
import {SafeAreaProvider} from "react-native-safe-area-context";
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { setAudioModeAsync } from 'expo-audio';
import { ErrorBoundary } from './app/components/ErrorBoundary';
import { StandaloneGate } from './app/components/StandaloneGate';
import { setupWebAudioUnlock } from './app/core/webAudioUnlock';


export default function App() {
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
            <AuthNavigator />
          </StandaloneGate>
        </ErrorBoundary>
        <StatusBar style="dark" />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}