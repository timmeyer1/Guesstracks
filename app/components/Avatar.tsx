// app/components/Avatar.tsx
import React from 'react'
import { View } from 'react-native'
import { Image } from 'expo-image'
import { User } from 'lucide-react-native'
import { COLORS } from '../core/constants/colors.constants'

type AvatarProps = {
    uri?: string | null
    size: number
    className?: string
}

// silhouette neutre pour les joueurs sans photo, en gros on utilise plus
// i.pravatar.cc : ça changeait de photo à chaque fois et piochait des
// vrais visages de gens qui ont jamais donné leur accord.
export const Avatar: React.FC<AvatarProps> = ({ uri, size, className }) => {
    if (uri) {
        return (
            <Image
                source={{ uri }}
                style={{ width: size, height: size, borderRadius: size / 2 }}
                className={className}
                cachePolicy="memory-disk"
                transition={100}
            />
        )
    }

    return (
        <View
            className={`bg-offwhite items-center justify-center ${className ?? ''}`}
            style={{ width: size, height: size, borderRadius: size / 2 }}
        >
            <User size={size * 0.5} color={COLORS.darkgray} />
        </View>
    )
}
