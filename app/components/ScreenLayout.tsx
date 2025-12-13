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
}

export const ScreenLayout = ({
    children,
    scrollable = false,
    centered = false,
    noPadding = false,
    bgColor = 'gray',
    className = ''
}: ScreenLayoutProps) => {
    const Container = scrollable ? ScrollView : View;

    const bgColorMap = {
        primary: 'bg-white',
        gray: 'bg-gray-50',
        dark: 'bg-zinc-900'
    };

    const baseClasses = `flex-1 ${bgColorMap[bgColor]}`;
    const paddingClasses = noPadding ? '' : 'px-8 py-20';
    const centerClasses = centered ? 'justify-center items-center' : '';

    const containerClasses = `${baseClasses} ${paddingClasses} ${centerClasses} ${className}`.trim();

    return (
        <Container
            className={containerClasses}
            contentContainerStyle={scrollable ? { flexGrow: 1 } : undefined}
        >
            {children}
        </Container>
    );
};