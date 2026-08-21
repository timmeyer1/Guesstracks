// app/components/LoadingSpinner.tsx
import React, { useEffect, useRef } from 'react';
import { Animated, Easing } from 'react-native';
import { LoaderCircle } from 'lucide-react-native';

type LoadingSpinnerProps = {
    size?: number;
    color?: string;
};

/** Icône de chargement (cercle en pointillés) qui tourne en boucle. */
export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({ size = 20, color = '#000' }) => {
    const rotation = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        const loop = Animated.loop(
            Animated.timing(rotation, {
                toValue: 1,
                duration: 900,
                easing: Easing.linear,
                useNativeDriver: true,
            })
        );
        loop.start();
        return () => loop.stop();
    }, [rotation]);

    const rotate = rotation.interpolate({
        inputRange: [0, 1],
        outputRange: ['0deg', '360deg'],
    });

    return (
        <Animated.View style={{ transform: [{ rotate }] }}>
            <LoaderCircle size={size} color={color} />
        </Animated.View>
    );
};
