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

// Illustration neutre (silhouette + fond uni) pour les joueurs sans photo,
// plutôt qu'un visage aléatoire de i.pravatar.cc : sans identifiant par
// joueur, cette API renvoyait une photo DIFFÉRENTE à chaque chargement pour
// le même joueur, en plus de piocher dans une base de vrais visages de
// personnes n'ayant jamais consenti à apparaître dans cette app.
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
