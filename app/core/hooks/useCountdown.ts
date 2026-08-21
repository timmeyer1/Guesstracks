// app/core/hooks/useCountdown.ts
import { useEffect, useState } from 'react'

/** Décompte partagé par RoundHeader et les composants de question (StatusPill "Temps restant"). */
export const useCountdown = (startedAt: number, duration: number) => {
    const [now, setNow] = useState(Date.now())

    useEffect(() => {
        setNow(Date.now())
        const interval = setInterval(() => setNow(Date.now()), 100)
        return () => clearInterval(interval)
    }, [startedAt])

    const durationMs = duration * 1000
    const elapsed = Math.min(durationMs, Math.max(0, now - startedAt))
    const remaining = Math.max(0, Math.ceil((durationMs - elapsed) / 1000))
    const progress = Math.max(0, 1 - elapsed / durationMs)

    return { remaining, progress }
}
