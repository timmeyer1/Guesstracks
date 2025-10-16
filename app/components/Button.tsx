import React, { useRef } from "react";
import { Animated, Pressable, Text, View } from "react-native";
import FontAwesome6 from '@expo/vector-icons/FontAwesome6';

type ButtonProps = {
    name: string;
    onPress?: () => void;
    className?: string;
    icon?: string;
    available?: boolean;
};

export const CustomButton = ({
    name,
    onPress,
    className,
    icon,
    available = true
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

    return (
        <Animated.View style={{ transform: [{ scale }] }} className="w-full">
            <Pressable
                onPressIn={handlePressIn}
                onPressOut={handlePressOut}
                onPress={available ? onPress : undefined}
                disabled={!available}
                className={`
                    rounded-full 
                    py-4 px-6
                    flex-row 
                    items-center 
                    justify-center 
                    gap-3
                    ${available ? className : 'bg-gray-700 opacity-50'}
                `}
            >
                {icon && (
                    <FontAwesome6
                        name={icon}
                        size={24}
                        color="white"
                    />
                )}
                <Text className="text-white text-lg font-semibold">
                    {name}
                </Text>
            </Pressable>

            {!available && (
                <Text className="text-xs text-gray-500 text-center mt-1">
                    coming soon
                </Text>
            )}
        </Animated.View>
    );
};