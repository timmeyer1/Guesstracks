// ScreenLayout.tsx
import { Platform, View, ScrollView } from 'react-native';
import React, { ReactNode } from 'react';

interface ScreenLayoutProps {
    children: ReactNode;
    scrollable?: boolean;
    centered?: boolean;
    noPadding?: boolean;
    bgColor?: 'primary' | 'gray' | 'dark';
    className?: string;
    /** Formes décoratives (voir <CornerShape />), affichées derrière le contenu et rognées aux bords de l'écran. */
    shapes?: ReactNode;
}

export const ScreenLayout = ({
    children,
    scrollable = false,
    centered = false,
    noPadding = false,
    bgColor = 'gray',
    className = '',
    shapes,
}: ScreenLayoutProps) => {
    const Container = scrollable ? ScrollView : View;

    const bgColorMap = {
        primary: 'bg-white',
        gray: 'bg-gray-50',
        dark: 'bg-zinc-900'
    };

    // py-20 (80px) vient d'un design pensé pour le natif, où le safe-area
    // (encoche + indicateur home) ne laisse jamais voir tout cet espace d'un
    // coup. Sur web en mode standalone (ajouté à l'écran d'accueil), l'app
    // tourne vraiment plein écran bord à bord : ces mêmes 80px en haut ET en
    // bas se voient bien plus et donnent une impression de vide, surtout en
    // bas d'écran après le dernier bouton — cf. discussion sur le "bloc
    // blanc" en bas du login. Réduit uniquement sur web, le natif ne change pas.
    const verticalPadding = Platform.OS === 'web' ? 'py-8' : 'py-20';
    const paddingClasses = noPadding ? '' : `px-8 ${verticalPadding}`;
    const centerClasses = centered ? 'justify-center items-center' : '';

    const containerClasses = `flex-1 ${paddingClasses} ${centerClasses} ${className}`.trim();

    return (
        <View className={`flex-1 ${bgColorMap[bgColor]} relative overflow-hidden`}>
            {shapes}
            <Container
                className={containerClasses}
                contentContainerStyle={scrollable ? { flexGrow: 1 } : undefined}
            >
                {children}
            </Container>
        </View>
    );
};