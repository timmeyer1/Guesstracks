// app/core/hooks/useRobustKeepAwake.ts
import { useEffect } from 'react'
import { Platform } from 'react-native'
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake'
import NoSleep from 'nosleep.js'

// En gros, nosleep.js empêche l'écran de s'éteindre : Wake Lock API si le
// navigateur la supporte, sinon une vidéo muette en boucle en secours. Sur
// iPhone, ça ne marche que si enable() part d'un vrai tap utilisateur —
// constaté en vrai, ça s'activait tout seul sur Android mais jamais sur iOS
// sans interaction.
const setupWebKeepAwake = (): (() => void) => {
    const noSleep = new NoSleep()

    const tryEnable = () => {
        if (noSleep.isEnabled) return
        noSleep.enable().catch(() => {})
    }

    // On tente tout de suite (suffit sur Android), et le geste ci-dessous prend le relais sur iPhone.
    tryEnable()

    const onGesture = () => {
        tryEnable()
        document.removeEventListener('pointerdown', onGesture)
        document.removeEventListener('keydown', onGesture)
    }
    document.addEventListener('pointerdown', onGesture)
    document.addEventListener('keydown', onGesture)

    // Filet en plus pour le repli vidéo : nosleep.js réarme la Wake Lock API tout seul au retour, pas la vidéo.
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
