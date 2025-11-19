import { View, ScrollView, ViewStyle } from 'react-native';
import React, { ReactNode } from 'react';

interface ScreenLayoutProps {
    children: ReactNode;
    scrollable?: boolean;
    centered?: boolean;
    noPadding?: boolean;
    className?: string;
}

export const ScreenLayout = ({
    children,
    scrollable = false,
    centered = false,
    noPadding = false,
    className = ''
}: ScreenLayoutProps) => {
    const Container = scrollable ? ScrollView : View;

    const baseClasses = 'flex-1 bg-[#1a1a1a]';
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