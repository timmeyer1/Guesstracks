import { Platform } from 'react-native'

export type DeviceKind = 'ios' | 'android' | 'desktop'

// Platform.OS vaut 'web' aussi bien sur iPhone/Android/PC (le site tourne
// dans un navigateur — ou en PWA installée, cf. StandaloneGate.tsx — sur les
// trois) : seul l'user agent permet de distinguer dans ce cas, Platform.OS
// suffit déjà en natif
export const getDeviceKind = (): DeviceKind => {
    if (Platform.OS === 'ios') return 'ios'
    if (Platform.OS === 'android') return 'android'
    if (Platform.OS === 'web' && typeof navigator !== 'undefined') {
        if (/iPhone|iPad|iPod/i.test(navigator.userAgent)) return 'ios'
        if (/Android/i.test(navigator.userAgent)) return 'android'
    }
    return 'desktop'
}
