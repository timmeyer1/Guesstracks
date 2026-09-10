// app/core/hooks/useRobustKeepAwake.ts
import { useEffect } from 'react'
import { Platform } from 'react-native'
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake'
import NoSleep from 'nosleep.js'

// nosleep.js choisit lui-même la Wake Lock API native si le navigateur la
// supporte, sinon une <video> muette en boucle avec de vrais fichiers vidéo
// encodés (webm + mp4) plutôt qu'un flux de canvas — contrairement à un flux
// live via canvas.captureStream(), qui se heurte à un bug WebKit documenté
// (échoue à jouer en <video> sur iOS, cf. bugs.webkit.org #181663). Sa doc
// est explicite : enable() DOIT partir d'un vrai geste utilisateur pour être
// fiable — confirmé en conditions réelles : le verrou (Wake Lock API
// pourtant supportée, iOS 18.4+, donc pas le bug de compatibilité connu sur
// les PWA installées) s'activait bien sur Android dès le montage du
// composant, jamais sur iPhone tant qu'il ne partait pas d'un tap.
const setupWebKeepAwake = (): (() => void) => {
    const noSleep = new NoSleep()

    const tryEnable = () => {
        if (noSleep.isEnabled) return
        noSleep.enable().catch(() => {})
    }

    // tenté tout de suite (suffit sur Android/Chrome), le déblocage au
    // premier geste ci-dessous prend le relais si ça n'a pas suffi (iPhone)
    tryEnable()

    const onGesture = () => {
        tryEnable()
        document.removeEventListener('pointerdown', onGesture)
        document.removeEventListener('keydown', onGesture)
    }
    document.addEventListener('pointerdown', onGesture)
    document.addEventListener('keydown', onGesture)

    // filet supplémentaire pour le repli vidéo (nosleep.js ne réarme que lui-
    // même le chemin Wake Lock API au retour au premier plan, jamais son
    // repli vidéo, cf. sa source)
    const onVisibilityChange = () => {
        if (document.visibilityState === 'visible') tryEnable()
    }
    document.addEventListener('visibilitychange', onVisibilityChange)

    return () => {
        document.removeEventListener('pointerdown', onGesture)
        document.removeEventListener('keydown', onGesture)
        document.removeEventListener('visibilitychange', onVisibilityChange)
        noSleep.disable()
    }
}

export const useRobustKeepAwake = () => {
    useEffect(() => {
        if (Platform.OS !== 'web' || typeof document === 'undefined') {
            activateKeepAwakeAsync().catch(() => {})
            return () => {
                deactivateKeepAwake().catch(() => {})
            }
        }

        return setupWebKeepAwake()
    }, [])
}
