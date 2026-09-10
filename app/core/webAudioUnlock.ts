// app/core/webAudioUnlock.ts
import { Platform } from 'react-native'

// Un seul AudioContext partagé pour toute l'app web (cf. useWebSyncedAudioPlayer,
// qui l'utilise pour planifier la lecture des extraits) : contrairement à un
// <audio> HTMLMediaElement (dont Safari iOS exige un geste utilisateur pour
// CHAQUE nouvel élément créé — testé en conditions réelles : une première tentative
// de déblocage via un <audio> muet fonctionnait sur Android mais jamais sur iPhone,
// où chaque manche recrée un nouvel élément jamais lui-même débloqué), le
// déblocage d'un AudioContext (resume() suite à un geste) reste valable pour
// TOUTES les lectures programmées dessus par la suite, quel que soit le moment.
let sharedContext: AudioContext | null = null

export const getWebAudioContext = (): AudioContext => {
    if (!sharedContext) {
        sharedContext = new AudioContext()
    }
    return sharedContext
}

// iOS Safari suspend l'AudioContext dès que l'onglet passe en arrière-plan
// (changement d'appli, verrouillage de l'écran...) : à appeler avant CHAQUE
// lecture, pas seulement au premier geste, sinon un extrait qui devrait démarrer
// pendant que l'app était en arrière-plan (cas courant avec la synchro sur
// startedAt) reste silencieux au retour au premier plan.
export const resumeWebAudioContext = (): Promise<void> => {
    const ctx = getWebAudioContext()
    if (ctx.state === 'suspended') return ctx.resume()
    return Promise.resolve()
}

// À appeler une seule fois au démarrage de l'app (cf. App.tsx). Sans lui,
// TOUS les play() programmatiques de useWebSyncedAudioPlayer seraient bloqués :
// ils partent systématiquement d'un setTimeout calé sur `startedAt` (synchro
// entre joueurs), jamais d'un clic direct.
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
