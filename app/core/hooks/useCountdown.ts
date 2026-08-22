// app/core/hooks/useCountdown.ts
import { useEffect, useState } from 'react'

// Le texte "Xs restantes" n'a besoin que d'un tick par seconde : un intervalle
// à 100ms ne change jamais ce qui est affiché mais re-rend le composant 10x
// plus souvent que nécessaire. La barre de progression animée (RoundHeader)
// tourne séparément sur le thread UI via Reanimated, pas via ce hook.
const computeRemaining = (startedAt: number, duration: number) =>
    Math.max(0, Math.ceil(duration - (Date.now() - startedAt) / 1000))

/** Décompte partagé par RoundHeader et les composants de question (StatusPill "Temps restant"). */
export const useCountdown = (startedAt: number, duration: number) => {
    const [remaining, setRemaining] = useState(() => computeRemaining(startedAt, duration))

    useEffect(() => {
        setRemaining(computeRemaining(startedAt, duration))
        const interval = setInterval(() => setRemaining(computeRemaining(startedAt, duration)), 1000)
        return () => clearInterval(interval)
    }, [startedAt, duration])

    return { remaining }
}
