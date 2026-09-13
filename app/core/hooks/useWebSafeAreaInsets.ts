// app/core/hooks/useWebSafeAreaInsets.ts
//
// Sur web, react-native-safe-area-context renvoie toujours 0 en mode appli
// installée sur iOS (bug connu). Dcp ce hook va chercher les vraies valeurs
// mesurées par public/index.html et les met à jour dès qu'elles arrivent.
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
