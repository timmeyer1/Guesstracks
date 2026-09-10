import { Alert as RNAlert, Platform } from 'react-native'

type AlertButton = {
    text?: string
    onPress?: () => void
    style?: 'default' | 'cancel' | 'destructive'
}

// react-native-web n'implémente PAS Alert.alert (node_modules/react-native-web/
// .../Alert/index.js : `static alert() {}`, un no-op complet) : tout écran qui
// passe par une confirmation Alert.alert (quitter le lobby, expulsion, erreurs
// de sauvegarde...) restait donc silencieusement inopérant sur web, aucun
// bouton n'étant jamais réellement affiché. Repli sur window.confirm/alert du
// navigateur pour le web uniquement — le natif garde le vrai Alert.alert.
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
