import { Platform } from 'react-native'

export type DeviceKind = 'ios' | 'android' | 'desktop'

// Platform.OS renvoie 'web' pour iPhone, Android et PC pareil. Dcp pour web on regarde en plus l'user agent.
export const getDeviceKind = (): DeviceKind => {
    if (Platform.OS === 'ios') return 'ios'
    if (Platform.OS === 'android') return 'android'
    if (Platform.OS === 'web' && typeof navigator !== 'undefined') {
        if (/iPhone|iPad|iPod/i.test(navigator.userAgent)) return 'ios'
        if (/Android/i.test(navigator.userAgent)) return 'android'
    }
    return 'desktop'
}
