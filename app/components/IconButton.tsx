import React from 'react'
import { Pressable } from 'react-native'
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated'
import * as LucideIcons from 'lucide-react-native'
import FontAwesome6 from '@expo/vector-icons/FontAwesome6'
import { COLORS, type ButtonVariant } from '../core/constants/colors.constants'

type IconButtonProps = {
    icon?: keyof typeof LucideIcons
    iconFA?: string
    onPress: () => void
    variant?: ButtonVariant
    className?: string
    color?: string
    /** 'md' (défaut) : taille historique (p-5). 'sm' : même hauteur qu'un CustomButton (py-4), pour s'aligner à côté d'un bouton texte. */
    size?: 'md' | 'sm'
}

const SIZE_PADDING = {
    md: 'p-5',
    sm: 'p-4',
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
    iconFA,
    onPress,
    variant = 'white',
    className = '',
    color,
    size = 'md',
}: IconButtonProps) => {
    const scale = useSharedValue(1)

    const handlePressIn = () => {
        scale.value = withSpring(0.96, { damping: 15, stiffness: 300 })
    }

    const handlePressOut = () => {
        scale.value = withSpring(1, { damping: 12, stiffness: 180 })
    }

    const animatedStyle = useAnimatedStyle(() => ({
        transform: [{ scale: scale.value }],
    }))

    const { iconColor, bgClass } = VARIANTS[variant]
    const IconComponent = icon ? (LucideIcons[icon] as React.ComponentType<any>) : null

    return (
        <Animated.View style={animatedStyle}>
            <Pressable
                onPressIn={handlePressIn}
                onPressOut={handlePressOut}
                onPress={onPress}
                className={`${bgClass} rounded-3xl ${SIZE_PADDING[size]} ${className}`}
            >
                {iconFA && <FontAwesome6 name={iconFA} size={24} color={color || iconColor} />}
                {IconComponent && <IconComponent size={24} color={color || iconColor} />}
            </Pressable>
        </Animated.View>
    )
}