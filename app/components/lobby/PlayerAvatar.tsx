// app/components/PlayerAvatar.tsx
import React from 'react'
import { View, Text, Image } from 'react-native'
import { Crown } from 'lucide-react-native'
import { COLORS } from '../../core/constants/colors.constants'

export const AVATAR_SIZES = {
    sm: 48,
    md: 80,
    lg: 96,
} as const

type AvatarSize = keyof typeof AVATAR_SIZES

interface PlayerAvatarProps {
    name: string
    img?: string
    isHost: boolean
    size?: AvatarSize
}

export const PlayerAvatar: React.FC<PlayerAvatarProps> = ({
    name,
    img,
    isHost,
    size = 'md'
}) => {
    const px = AVATAR_SIZES[size]
    // cut le nom si trop long
    const displayName = name.length > 6 ? `${name.slice(0, 6)}...` : name

    return (
        <View className="items-center" style={{ width: px }}>
            <View style={{ paddingTop: px * 0.2 }}>
                <View className="relative items-center mb-1">
                    {isHost && (
                        <View
                            className="absolute -top-1 z-10 bg-white rounded-md p-1"
                            style={{ top: -(px * 0.2) }} // remonte dans le padding
                        >
                            <Crown size={px * 0.31} color={COLORS.primary} fill={COLORS.primary} />
                        </View>
                    )}
                    <Image
                        source={{ uri: img || 'https://i.pravatar.cc/100' }}
                        style={{ width: px, height: px, borderRadius: px / 2 }}
                    />
                </View>
            </View>

            <Text className="text-primary text-sm font-semibold capitalize">
                {displayName}
            </Text>
        </View>
    )
}