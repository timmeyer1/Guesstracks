// ScreenLayout.tsx
import { View, ScrollView } from 'react-native';
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

    const paddingClasses = noPadding ? '' : 'px-8 py-20';
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