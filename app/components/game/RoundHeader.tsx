import React from 'react'
import { Text } from 'react-native'

type RoundHeaderProps = {
    roundIndex: number
    totalRounds: number
}

// N'affiche que "Manche X/Y" : le décompte et la barre de progression sont
// affichés séparément (cf. CountdownLabel), au plus près de leur StatusPill,
// pour ne jamais faire re-rendre le reste de l'écran de jeu à chaque tick
// (cf. audit perf, findings I1/I2). Un variant "complet" avec countdown +
// barre de progression intégrés existait ici mais n'était plus jamais monté
// (compact valait toujours true côté appelant) : supprimé plutôt que gardé
// en code mort (cf. audit qualité, finding N3).
export const RoundHeader: React.FC<RoundHeaderProps> = React.memo(function RoundHeader({ roundIndex, totalRounds }) {
    return (
        <Text className="text-black font-bold text-base text-center mb-4">
            Manche {roundIndex + 1}/{totalRounds}
        </Text>
    )
})
