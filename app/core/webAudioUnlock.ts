// app/core/webAudioUnlock.ts
import { Platform } from 'react-native'

// Un seul AudioContext pour toute l'app web. Contrairement à une balise
// <audio> que Safari iOS bloque à chaque nouvel extrait, celui-ci reste débloqué pour toutes les lectures suivantes.
let sharedContext: AudioContext | null = null

export const getWebAudioContext = (): AudioContext => {
    if (!sharedContext) {
        sharedContext = new AudioContext()
    }
    return sharedContext
}

// iOS Safari met l'AudioContext en pause quand l'onglet passe en arrière-plan.
// Dcp on rappelle ça avant chaque lecture, pas juste au premier clic, sinon un extrait reste muet au retour.
export const resumeWebAudioContext = (): Promise<void> => {
    const ctx = getWebAudioContext()
    if (ctx.state === 'suspended') return ctx.resume()
    return Promise.resolve()
}

// À appeler une seule fois au démarrage de l'app. Sans ça, les play()
// automatiques (déclenchés par un timer, pas un clic) resteraient bloqués.
export const setupWebAudioUnlock = () => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return

    const unlock = () => {
        resumeWebAudioContext().then(() => {
            document.removeEventListener('pointerdown', unlock)
            document.removeEventListener('keydown', unlock)
        })
    }

    document.addEventListener('pointerdown', unlock)
    document.addEventListener('keydown', unlock)
}
