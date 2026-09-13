// ScreenLayout.tsx
import { Platform, View, ScrollView } from 'react-native';
import React, { ReactNode } from 'react';
import { useWebSafeAreaInsets } from '../core/hooks/useWebSafeAreaInsets';

// petite marge en plus de l'inset réel sur web, le natif touche pas à ça
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

    // 80px de padding c'était pensé pour le natif (safe-area qui bouffe une
    // partie). En mode standalone web, l'app est plein écran, dcp ces 80px
    // faisaient un gros vide en bas. On réduit juste sur web.
    const verticalPadding = Platform.OS === 'web' ? 'py-8' : 'py-20';
    const paddingClasses = noPadding ? '' : `px-8 ${verticalPadding}`;
    const centerClasses = centered ? 'justify-center items-center' : '';

    const containerClasses = `flex-1 ${paddingClasses} ${centerClasses} ${className}`.trim();

    // les 32px suffisent pas pour l'île dynamique iOS en mode standalone,
    // dcp on remplace le haut par le vrai inset mesuré + une petite marge.
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