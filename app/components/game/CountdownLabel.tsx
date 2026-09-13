import React from 'react'
import { Text } from 'react-native'
import { useCountdown } from '../../core/hooks/useCountdown'

type CountdownLabelProps = {
    startedAt: number
    duration: number
}

// on isole le compte à rebours dans son propre petit composant pour que
// seul ce texte se re-rende chaque seconde, pas tout l'écran au-dessus
export const CountdownLabel: React.FC<CountdownLabelProps> = ({ startedAt, duration }) => {
    const { remaining } = useCountdown(startedAt, duration)
    return <Text className="text-black font-semibold text-sm">{`Temps restant : ${remaining}s`}</Text>
}
