import React, { useRef } from 'react'
import { Pressable, Animated } from 'react-native'
import * as LucideIcons from 'lucide-react-native'
import { COLORS, type ButtonVariant } from '../core/constants/colors.constants'

type IconButtonProps = {
    icon: keyof typeof LucideIcons
    onPress: () => void
    variant?: ButtonVariant
    className?: string
    color?: string
}

const VARIANTS = {
    white: { iconColor: COLORS.dark, bgClass: 'bg-offwhite' },
    dark: { iconColor: COLORS.white, bgClass: 'bg-dark' },
    spotify: { iconColor: COLORS.spotify, bgClass: 'bg-offwhite' },
    deezer: { iconColor: COLORS.deezer, bgClass: 'bg-offwhite' },
    apple_music: { iconColor: COLORS.apple_music, bgClass: 'bg-offwhite' },
    youtube_music: { iconColor: COLORS.youtube_music, bgClass: 'bg-offwhite' },
}

export const IconButton = ({
    icon,
    onPress,
    variant = 'white',
    className = '',
    color,
}: IconButtonProps) => {
    const scale = useRef(new Animated.Value(1)).current

    const handlePressIn = () => {
        Animated.spring(scale, {
            toValue: 0.96,
            useNativeDriver: true,
            speed: 50,
        }).start()
    }

    const handlePressOut = () => {
        Animated.spring(scale, {
            toValue: 1,
            useNativeDriver: true,
            speed: 20,
        }).start()
    }

    const { iconColor, bgClass } = VARIANTS[variant]
    const IconComponent = LucideIcons[icon] as React.ComponentType<any>

    return (
        <Animated.View style={{ transform: [{ scale }] }}>
            <Pressable
                onPressIn={handlePressIn}
                onPressOut={handlePressOut}
                onPress={onPress}
                className={`${bgClass} rounded-3xl p-5 ${className}`}
            >
                <IconComponent size={24} color={color || iconColor} />
            </Pressable>
        </Animated.View>
    )
}