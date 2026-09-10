// app/core/hooks/useWebSafeAreaInsets.ts
//
// Sur web, react-native-safe-area-context reste bloqué à { top: 0, bottom: 0 }
// en mode standalone iOS (cf. public/index.html pour le détail exact du bug
// dans sa sonde CSS) : ce hook lit à la place les vraies valeurs mesurées par
// le script de public/index.html, mises à jour dès qu'elles sont connues,
// aucune valeur figée à l'instant du premier rendu React (forcément trop tôt).
import { useEffect, useState } from 'react'
import { Platform } from 'react-native'

type WebSafeAreaInsets = { top: number; bottom: number }

const ZERO_INSETS: WebSafeAreaInsets = { top: 0, bottom: 0 }

const readCurrent = (): WebSafeAreaInsets => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return ZERO_INSETS
    return (window as unknown as { __webSafeAreaInsets?: WebSafeAreaInsets }).__webSafeAreaInsets ?? ZERO_INSETS
}

export const useWebSafeAreaInsets = (): WebSafeAreaInsets => {
    const [insets, setInsets] = useState<WebSafeAreaInsets>(readCurrent)

    useEffect(() => {
        if (Platform.OS !== 'web' || typeof window === 'undefined') return

        const onChange = (event: Event) => setInsets((event as CustomEvent<WebSafeAreaInsets>).detail)
        window.addEventListener('webSafeAreaInsetsChange', onChange)
        return () => window.removeEventListener('webSafeAreaInsetsChange', onChange)
    }, [])

    return insets
}
