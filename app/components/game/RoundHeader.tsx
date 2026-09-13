import React from 'react'
import { Text } from 'react-native'

type RoundHeaderProps = {
    roundIndex: number
    totalRounds: number
}

// affiche juste "Manche X/Y" : le décompte est ailleurs (CountdownLabel)
// pour pas re-rendre tout l'écran à chaque seconde
export const RoundHeader: React.FC<RoundHeaderProps> = React.memo(function RoundHeader({ roundIndex, totalRounds }) {
    return (
        <Text className="text-black font-bold text-base text-center mb-4">
            Manche {roundIndex + 1}/{totalRounds}
        </Text>
    )
})
