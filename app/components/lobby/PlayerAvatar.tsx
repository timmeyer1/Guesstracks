// app/components/PlayerAvatar.tsx
import React from 'react'
import { View, Text, Image } from 'react-native'
import { Crown } from 'lucide-react-native'
import { COLORS } from '../../core/constants/colors.constants'

interface PlayerAvatarProps {
    name: string
    img?: string
    isHost: boolean
}

export const PlayerAvatar: React.FC<PlayerAvatarProps> = ({
    name,
    img,
    isHost
}) => {
    // cut le nom si trop long
    const displayName = name.length > 6 ? `${name.slice(0, 6)}...` : name

    return (
        <View className="items-center" style={{ width: 80 }}>
            <View className="relative items-center mb-1" style={{ paddingTop: 16 }}>
                {isHost && (
                    <View className="absolute -top-1 z-10 bg-white rounded-md p-1">
                        <Crown
                            size={25}
                            color={COLORS.primary}
                            fill={COLORS.primary}
                        />
                    </View>
                )}

                <Image
                    source={{ uri: img || 'https://i.pravatar.cc/100' }}
                    className="w-20 h-20 rounded-full"
                />
            </View>

            <Text className="text-primary text-sm font-semibold capitalize">
                {displayName}
            </Text>
        </View>
    )
}