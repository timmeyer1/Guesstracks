// ScreenLayout.tsx
import { Platform, View, ScrollView } from 'react-native';
import React, { ReactNode } from 'react';
import { useWebSafeAreaInsets } from '../core/hooks/useWebSafeAreaInsets';

// espace sous la zone de sécurité (encoche/île dynamique) sur web, EN PLUS de
// l'inset réel mesuré par useWebSafeAreaInsets — le natif garde son py-20
// flat, inchangé (jamais concerné par le bug de mesure que ce hook contourne,
// cf. ce fichier).
const WEB_TOP_SAFE_AREA_GAP = 16;

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
    const webInsets = useWebSafeAreaInsets();

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

    // py-8 (32px) ci-dessus ne suffit pas à dégager l'encoche/île dynamique en
    // mode standalone iOS (confirmé en conditions réelles : pastille/pochette
    // partiellement masquées) — remplace juste le haut par le vrai inset mesuré
    // (cf. useWebSafeAreaInsets) + une marge de respiration, sans toucher au
    // bas (32px suffisants là, jamais signalé comme trop court).
    const topInsetStyle =
        !noPadding && Platform.OS === 'web' ? { paddingTop: webInsets.top + WEB_TOP_SAFE_AREA_GAP } : undefined;

    return (
        <View className={`flex-1 ${bgColorMap[bgColor]} relative overflow-hidden`}>
            {shapes}
            <Container
                className={containerClasses}
                style={topInsetStyle}
                contentContainerStyle={scrollable ? { flexGrow: 1 } : undefined}
            >
                {children}
            </Container>
        </View>
    );
};