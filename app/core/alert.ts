import { Alert as RNAlert, Platform } from 'react-native'

type AlertButton = {
    text?: string
    onPress?: () => void
    style?: 'default' | 'cancel' | 'destructive'
}

// Sur web, Alert.alert ne fait rien (no-op de react-native-web), dcp les
// popups de confirmation restaient invisibles. On bascule sur confirm/alert
// du navigateur juste pour le web, le natif garde le vrai Alert.alert.
const alertOnWeb = (title: string, message?: string, buttons?: AlertButton[]) => {
    const fullMessage = [title, message].filter(Boolean).join('\n\n')

    if (!buttons || buttons.length <= 1) {
        window.alert(fullMessage)
        buttons?.[0]?.onPress?.()
        return
    }

    const cancelButton = buttons.find((b) => b.style === 'cancel')
    const confirmButton = buttons.find((b) => b.style !== 'cancel') ?? buttons[buttons.length - 1]

    if (window.confirm(fullMessage)) {
        confirmButton?.onPress?.()
    } else {
        cancelButton?.onPress?.()
    }
}

export const Alert = {
    alert: (
        title: string,
        message?: string,
        buttons?: AlertButton[],
        options?: { cancelable?: boolean; onDismiss?: () => void }
    ) => {
        if (Platform.OS === 'web') {
            alertOnWeb(title, message, buttons)
        } else {
            RNAlert.alert(title, message, buttons, options)
        }
    },
}
