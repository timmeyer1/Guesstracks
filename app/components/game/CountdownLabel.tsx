import React from 'react'
import { Text } from 'react-native'
import { useCountdown } from '../../core/hooks/useCountdown'

type CountdownLabelProps = {
    startedAt: number
    duration: number
}

// Isole le tick de useCountdown (1x/seconde) dans ce petit composant plutôt
// que dans l'écran/la question parents : seul ce <Text> re-rend chaque
// seconde, pas tout l'arbre (RoundHeader, AudioPlayer, liste d'options...)
// au-dessus de lui. Cf. audit perf, findings I1/I2.
export const CountdownLabel: React.FC<CountdownLabelProps> = ({ startedAt, duration }) => {
    const { remaining } = useCountdown(startedAt, duration)
    return <Text className="text-black font-semibold text-sm">{`Temps restant : ${remaining}s`}</Text>
}
