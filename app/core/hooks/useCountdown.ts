// app/core/hooks/useCountdown.ts
import { useEffect, useState } from 'react'

// le texte "Xs restantes" a juste besoin d'un tick par seconde, pas plus.
// un intervalle à 100ms afficherait pareil mais re-rendrait le composant
// pour rien, 10x trop souvent. la barre animée (RoundHeader), elle, tourne
// à part avec Reanimated, pas avec ce hook.
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
