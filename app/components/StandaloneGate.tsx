import { useState } from 'react'
import { Image, Platform, Pressable, Text, View } from 'react-native'
import type { ReactNode } from 'react'
import { ScreenLayout } from './ScreenLayout'
import { SectionTitle } from './SectionTitle'

// que sur mobile, en gros sur ordi "ajouter à l'écran d'accueil" ça veut rien dire
const isMobileOS = () => {
    if (Platform.OS !== 'web' || typeof navigator === 'undefined') return false
    return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
}

// sur iOS Safari, `navigator.standalone` dit si l'app tourne depuis l'icône
// ajoutée. Sur Android/Chrome ça existe pas, dcp on check `display-mode` à la place.
const isRunningStandalone = () => {
    if (Platform.OS !== 'web') return true
    if (typeof window === 'undefined') return true

    const iosStandalone = (window.navigator as unknown as { standalone?: boolean }).standalone === true
    const displayModeStandalone = window.matchMedia?.('(display-mode: standalone)').matches ?? false

    return iosStandalone || displayModeStandalone
}

// que localhost/127.0.0.1, pas le tunnel : __DEV__ suffisait pas, ça
// désactivait le blocage aussi chez un pote qui ouvre le lien du tunnel.
const isLocalhost = () => {
    if (Platform.OS !== 'web') return false
    if (typeof window === 'undefined') return false
    return ['localhost', '127.0.0.1'].includes(window.location.hostname)
}

const DISMISSED_KEY = 'guesstracks:standaloneGateDismissed'

const readDismissed = () => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return false
    try {
        return window.localStorage.getItem(DISMISSED_KEY) === 'true'
    } catch {
        return false
    }
}

export const StandaloneGate = ({ children }: { children: ReactNode }) => {
    // lu une seule fois au montage, pas besoin de re-checker localStorage à chaque render
    const [dismissed, setDismissed] = useState(readDismissed)

    if (!isMobileOS() || isLocalhost() || isRunningStandalone() || dismissed) {
        return <>{children}</>
    }

    const handleSkip = () => {
        try {
            window.localStorage.setItem(DISMISSED_KEY, 'true')
        } catch {
            // pas grave si localStorage marche pas (navigation privée...), le message reviendra
        }
        setDismissed(true)
    }

    return (
        <ScreenLayout centered>
            <Image
                source={require('../images/logo.png')}
                style={{ width: 96, height: 96, marginBottom: 24, borderRadius: 16 }}
            />
            <SectionTitle
                title="Ajoute Guesstracks à ton écran d'accueil"
                subtitle="Ce jeu se joue en plein écran, comme une vraie app."
                align="center"
                size="md"
                className="mb-8"
            />

            <View className="w-full gap-4">
                <View className="bg-offwhite rounded-2xl p-4">
                    <Text className="font-bold text-black mb-1">Sur iPhone / iPad (Safari)</Text>
                    <Text className="text-darkgray">
                        Appuie sur <Text className="font-bold">Partager</Text> (le carré avec la
                        flèche), puis <Text className="font-bold">Sur l'écran d'accueil</Text>.
                    </Text>
                </View>

                <View className="bg-offwhite rounded-2xl p-4">
                    <Text className="font-bold text-black mb-1">Sur Android (Chrome)</Text>
                    <Text className="text-darkgray">
                        Ouvre le menu <Text className="font-bold">⋮</Text>, puis{' '}
                        <Text className="font-bold">Installer l'application</Text> (ou{' '}
                        <Text className="font-bold">Ajouter à l'écran d'accueil</Text>).
                    </Text>
                </View>
            </View>

            <Text className="text-darkgray text-center mt-8">
                Lance ensuite l'app depuis l'icône ajoutée sur ton écran d'accueil.
            </Text>

            <Pressable onPress={handleSkip} hitSlop={8} className="mt-6">
                <Text className="text-darkgray text-center underline">Pas pour l'instant</Text>
            </Pressable>
        </ScreenLayout>
    )
}
