import React, { useRef } from 'react';
import { View, Pressable, Animated } from 'react-native';
import FontAwesome6 from '@expo/vector-icons/FontAwesome6';
import { ButtonVariant, buttonVariants } from '../core/constants/variants.constants';

type IconButtonProps = {
    icon: string;
    onPress: () => void;
    variant?: ButtonVariant;
    className?: string;
    color?: string;
};

export const IconButton = ({
    icon,
    onPress,
    variant = 'white',
    className = '',
    color,
}: IconButtonProps) => {
    const scale = useRef(new Animated.Value(1)).current;

    const handlePressIn = () => {
        Animated.spring(scale, {
            toValue: 0.96,
            useNativeDriver: true,
            speed: 50,
        }).start();
    };

    const handlePressOut = () => {
        Animated.spring(scale, {
            toValue: 1,
            useNativeDriver: true,
            speed: 20,
        }).start();
    };

    const { iconColor, bgClass } = buttonVariants[variant];

    return (
        <Animated.View style={{ transform: [{ scale }] }}>
            <Pressable
                onPressIn={handlePressIn}
                onPressOut={handlePressOut}
                onPress={onPress}
                className={`${bgClass} rounded-3xl p-5 ${className}`}
            >
                <FontAwesome6 name={icon} size={24} color={color || iconColor} />
            </Pressable>
        </Animated.View>
    );
};