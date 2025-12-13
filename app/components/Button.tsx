import React, { useRef } from "react";
import { Animated, Pressable, Text, View } from "react-native";
import FontAwesome6 from '@expo/vector-icons/FontAwesome6';
import { ButtonVariant, buttonVariants } from "../core/constants/variants.constants";

type ButtonProps = {
    name: string;
    onPress?: () => void;
    className?: string;
    icon?: string;
    available?: boolean;
    disabled?: boolean;
    variant?: ButtonVariant;
};

export const CustomButton = ({
    name,
    onPress,
    className,
    icon,
    available = true,
    variant = 'white',
}: ButtonProps) => {
    const scale = useRef(new Animated.Value(1)).current;

    const handlePressIn = () => {
        if (!available) return;
        Animated.spring(scale, {
            toValue: 0.96,
            useNativeDriver: true,
            speed: 50,
        }).start();
    };

    const handlePressOut = () => {
        if (!available) return;
        Animated.spring(scale, {
            toValue: 1,
            useNativeDriver: true,
            speed: 20,
        }).start();
    };

    const { textClass, iconColor, bgClass } = buttonVariants[variant];

    return (
        <Animated.View style={{ transform: [{ scale }] }} className="w-full">
            <Pressable
                onPressIn={handlePressIn}
                onPressOut={handlePressOut}
                onPress={available ? onPress : undefined}
                disabled={!available}
                className={`
                    rounded-2xl
                    py-4 px-6
                    flex-row 
                    items-center 
                    justify-center 
                    gap-3
                    ${available ? bgClass : 'bg-darkgray opacity-25'}
                    ${className}
                `}
            >
                {icon && (
                    <FontAwesome6
                        name={icon}
                        size={24}
                        color={available ? iconColor : '#888888'}
                    />
                )}
                <Text className={`text-sm font-semibold ${available ? textClass : 'text-gray-500'}`}>
                    {name}
                </Text>
            </Pressable>
        </Animated.View>
    );
};