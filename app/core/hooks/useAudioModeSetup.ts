import { useEffect, useRef } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { setAudioModeAsync } from 'expo-audio';

// Sur iOS, la catégorie de session audio qui permet d'ignorer l'interrupteur
// sonnerie/silencieux est réinitialisée par le système à chaque fois que
// l'app repasse en arrière-plan (écran verrouillé, appel, notification...).
// Sans la réappliquer au retour au premier plan, les extraits redeviennent
// muets si le téléphone est en mode silencieux, même si tout semble normal
// côté app (bug repéré en vrai : ça marchait au lancement puis plus un seul
// son ne sortait après avoir verrouillé/déverrouillé le téléphone).
export const configureAudioMode = () =>
    setAudioModeAsync({
        playsInSilentMode: true,
        interruptionMode: 'duckOthers',
        shouldPlayInBackground: false,
    }).catch((err) => {
        console.error('❌ Échec de la configuration du mode audio :', err);
    });

export const useAudioModeSetup = () => {
    const appState = useRef<AppStateStatus>(AppState.currentState);

    useEffect(() => {
        configureAudioMode();

        const subscription = AppState.addEventListener('change', (nextState) => {
            const cameBackToForeground = appState.current !== 'active' && nextState === 'active';
            appState.current = nextState;
            if (cameBackToForeground) configureAudioMode();
        });

        return () => subscription.remove();
    }, []);
};
