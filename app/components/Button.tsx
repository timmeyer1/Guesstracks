import React, { useRef } from "react"
import { Animated, Pressable, Text } from "react-native"
import * as LucideIcons from 'lucide-react-native'
import FontAwesome6 from '@expo/vector-icons/FontAwesome6'
import { COLORS, type ButtonVariant } from "../core/constants/colors.constants"
import { LoadingSpinner } from "./LoadingSpinner"

type ButtonProps = {
    name: string
    onPress?: () => void
    className?: string
    icon?: keyof typeof LucideIcons
    iconFA?: string
    available?: boolean
    variant?: ButtonVariant
    /** Affiche une icône de chargement animée à la place de l'icône, et désactive le bouton. */
    loading?: boolean
}

const VARIANTS = {
    white: { textClass: 'text-black', iconColor: COLORS.dark, bgClass: 'bg-offwhite' },
    dark: { textClass: 'text-white', iconColor: COLORS.white, bgClass: 'bg-dark' },
    spotify: { textClass: 'text-spotify', iconColor: COLORS.spotify, bgClass: 'bg-offwhite' },
    deezer: { textClass: 'text-deezer', iconColor: COLORS.deezer, bgClass: 'bg-offwhite' },
    apple_music: { textClass: 'text-apple_music', iconColor: COLORS.apple_music, bgClass: 'bg-offwhite' },
    youtube_music: { textClass: 'text-youtube_music', iconColor: COLORS.youtube_music, bgClass: 'bg-offwhite' },
}

export const CustomButton = ({
    name,
    onPress,
    className,
    icon,
    iconFA,
    available = true,
    variant = 'white',
    loading = false,
}: ButtonProps) => {
    const scale = useRef(new Animated.Value(1)).current
    const isAvailable = available && !loading

    const handlePressIn = () => {
        if (!isAvailable) return
        Animated.spring(scale, {
            toValue: 0.96,
            useNativeDriver: true,
            speed: 50,
        }).start()
    }

    const handlePressOut = () => {
        if (!isAvailable) return
        Animated.spring(scale, {
            toValue: 1,
            useNativeDriver: true,
            speed: 20,
        }).start()
    }

    const { textClass, iconColor, bgClass } = VARIANTS[variant]
    const IconComponent = icon ? (LucideIcons[icon] as React.ComponentType<any>) : null

    return (
        <Animated.View style={{ transform: [{ scale }] }} className="w-full">
            <Pressable
                onPressIn={handlePressIn}
                onPressOut={handlePressOut}
                onPress={isAvailable ? onPress : undefined}
                disabled={!isAvailable}
                className={`
                    rounded-2xl py-4 px-6 flex-row items-center justify-center gap-3
                    ${available ? bgClass : 'bg-darkgray opacity-25'}
                    ${className}
                `}
            >
                {loading ? (
                    <LoadingSpinner size={24} color={available ? iconColor : COLORS.darkgray} />
                ) : (
                    <>
                        {iconFA && (
                            <FontAwesome6
                                name={iconFA}
                                size={24}
                                color={available ? iconColor : COLORS.darkgray}
                            />
                        )}

                        {IconComponent && (
                            <IconComponent
                                size={24}
                                color={available ? iconColor : COLORS.darkgray}
                            />
                        )}
                    </>
                )}

                <Text className={`text-sm font-semibold ${available ? textClass : 'text-gray-500'}`}>
                    {name}
                </Text>
            </Pressable>
        </Animated.View>
    )
}