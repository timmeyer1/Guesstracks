import React from 'react'
import { ScreenLayout } from './ScreenLayout'
import { SectionTitle } from './SectionTitle'
import { CustomButton } from './Button'

type Props = { children: React.ReactNode }
type State = { hasError: boolean }

// filet de sécurité autour de toute l'app, sinon une erreur de rendu (genre
// un payload socket bizarre pendant une partie) fait tout planter pour tout le monde
export class ErrorBoundary extends React.Component<Props, State> {
    state: State = { hasError: false }

    static getDerivedStateFromError(): State {
        return { hasError: true }
    }

    componentDidCatch(error: Error, info: React.ErrorInfo) {
        console.error('💥 Crash de rendu :', error, info.componentStack)
    }

    // "Réessayer" retente juste un rendu, ça marche pour une erreur ponctuelle
    // mais pas pour un bug qui revient à chaque fois, d'où le message en dessous.
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
