import React, { useRef } from "react";
import {Animated, Pressable, Text, View} from "react-native";
import FontAwesome6 from '@expo/vector-icons/FontAwesome6';

type ButtonProps = {
    name: string;
    onPress?: () => void;
    className?: string;
    icon?: string;
    available?: boolean;
};

export const CustomButton = ({ name, onPress, className, icon, available = true }: ButtonProps) => {
    const scale = useRef(new Animated.Value(1)).current;

    const handlePressIn = () => {
        if (!available) return;
        Animated.spring(scale, {
            toValue: 0.95,
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

    const buttonClass = available
        ? className
        : "bg-gray-600";

    return (
        <Animated.View style={{ transform: [{ scale }] }}>
            <Pressable
                onPressIn={handlePressIn}
                onPressOut={handlePressOut}
                onPress={available ? onPress : undefined}
                disabled={!available}
                className={`flex flex-col items-center`}
            >
                <View className={`gap-2 rounded-full py-3 flex flex-row justify-center w-full mt-4 min-w-full ${buttonClass} ${className}`}>
                    {icon && <FontAwesome6 name={icon} size={34} color="white" />}
                    <Text className="text-white text-lg font-semibold">{name}</Text>
                </View>
                {!available && <Text className={'text-sm text-white'}>comming soon</Text>}
            </Pressable>
        </Animated.View>
    );
};
