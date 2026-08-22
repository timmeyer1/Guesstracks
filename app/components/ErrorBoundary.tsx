import React from 'react'
import { ScreenLayout } from './ScreenLayout'
import { SectionTitle } from './SectionTitle'
import { CustomButton } from './Button'

type Props = { children: React.ReactNode }
type State = { hasError: boolean }

// Filet de sécurité autour de tout l'app (cf. App.tsx) : sans lui, une
// exception de rendu (ex. un payload socket inattendu pendant une partie,
// cf. audit sécurité/robustesse, finding I7) fait tomber l'app entière sur
// l'écran rouge/blanc de React Native, en pleine partie, pour tous les
// joueurs simultanément si la cause est un payload serveur.
export class ErrorBoundary extends React.Component<Props, State> {
    state: State = { hasError: false }

    static getDerivedStateFromError(): State {
        return { hasError: true }
    }

    componentDidCatch(error: Error, info: React.ErrorInfo) {
        console.error('💥 Crash de rendu :', error, info.componentStack)
    }

    // "Réessayer" retente juste un nouveau rendu de l'arbre : suffisant pour
    // une exception ponctuelle (payload malformé, etc.), pas pour un bug
    // systématique qui se reproduira au prochain rendu identique — dans ce
    // cas l'utilisateur doit quitter/relancer l'app, d'où le message ci-dessous.
    private handleRetry = () => {
        this.setState({ hasError: false })
    }

    render() {
        if (this.state.hasError) {
            return (
                <ScreenLayout centered bgColor="dark">
                    <SectionTitle
                        title="Oups, un problème est survenu"
                        subtitle="Quelque chose s'est mal passé. Réessaie — si ça persiste, quitte et relance l'app."
                        align="center"
                        size="lg"
                        titleClassName="text-white"
                        subtitleClassName="text-offwhite"
                        className="mb-8"
                    />
                    <CustomButton name="Réessayer" onPress={this.handleRetry} variant="white" />
                </ScreenLayout>
            )
        }

        return this.props.children
    }
}
