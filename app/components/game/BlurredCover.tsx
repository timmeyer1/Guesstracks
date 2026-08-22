import React from 'react'
import { View } from 'react-native'
import { Image } from 'expo-image'
import { Music } from 'lucide-react-native'
import { COLORS } from '../../core/constants/colors.constants'

type BlurredCoverProps = {
    imageUri?: string | null
    size?: number
}

// pochette bien floutée (blurRadius natif RN + voile semi-opaque en renfort,
// pour rester illisible quelle que soit la plateforme) : ne doit jamais
// laisser deviner le titre à trouver en mode blindtest
export const BlurredCover: React.FC<BlurredCoverProps> = ({ imageUri, size = 160 }) => {
    const dimension = { width: size, height: size }
    const iconSize = Math.round(size * 0.25)

    if (!imageUri) {
        return (
            <View
                className="bg-offwhite rounded-3xl items-center justify-center"
                style={dimension}
            >
                <Music size={iconSize} color={COLORS.darkgray} />
            </View>
        )
    }

    return (
        <View className="rounded-3xl overflow-hidden bg-offwhite" style={dimension}>
            <Image
                source={{ uri: imageUri }}
                style={{ width: '100%', height: '100%' }}
                blurRadius={35}
                cachePolicy="memory-disk"
                transition={100}
            />
            <View
                className="absolute inset-0 items-center justify-center"
                style={{ backgroundColor: 'rgba(2, 2, 2, 0.45)' }}
            >
                <Music size={iconSize} color={COLORS.white} />
            </View>
        </View>
    )
}
