// app/core/hooks/useWebSyncedAudioPlayer.ts
//
// version web du lecteur audio synchro. en mode, on passe par l'AudioContext
// plutôt que par expo-audio, dcp Safari iOS redemande un geste utilisateur à
// chaque nouvel extrait, alors que nos manches démarrent toutes seules. un
// AudioContext débloqué une fois (voir webAudioUnlock.ts) reste bon pour
// toutes les lectures suivantes, quel que soit l'extrait.
import { useEffect, useRef, useState } from 'react'
import { getWebAudioContext, resumeWebAudioContext } from '../webAudioUnlock'
import type { SyncedAudioPlayer, UseSyncedAudioPlayerOptions } from './useSyncedAudioPlayer.types'

// Cache des extraits déjà décodés, pour pas re-télécharger le même son.
const bufferCache = new Map<string, Promise<AudioBuffer>>()

const loadBuffer = (url: string): Promise<AudioBuffer> => {
    const cached = bufferCache.get(url)
    if (cached) return cached

    const promise = fetch(url)
        .then((res) => res.arrayBuffer())
        .then((data) => getWebAudioContext().decodeAudioData(data))
    // Si ça échoue, on vire du cache pour réessayer proprement la prochaine fois.
    promise.catch(() => bufferCache.delete(url))
    bufferCache.set(url, promise)
    return promise
}

type ActiveSource = {
    node: AudioBufferSourceNode
    // node.start() n'a peut-être pas encore vraiment tourné (en attente de
    // resumeWebAudioContext()) — appeler stop() dessus avant plante.
    started: boolean
}

export const useWebSyncedAudioPlayer = ({
    previewUrl,
    autoPlay = true,
    startedAt,
}: UseSyncedAudioPlayerOptions): SyncedAudioPlayer => {
    const [isLoaded, setIsLoaded] = useState(false)
    const [playing, setPlaying] = useState(false)
    const [didJustFinish, setDidJustFinish] = useState(false)

    const bufferRef = useRef<AudioBuffer | null>(null)
    const activeRef = useRef<ActiveSource | null>(null)
    // Position en secondes d'où repartir au prochain démarrage.
    const offsetRef = useRef(0)
    const startCtxTimeRef = useRef(0)
    // Comme côté natif : le rattrapage sur startedAt se fait qu'une fois par extrait.
    const syncedForUrlRef = useRef<string | null | undefined>(undefined)

    const stop = () => {
        const current = activeRef.current
        if (!current) return
        current.node.onended = null
        activeRef.current = null
        setPlaying(false)
        if (current.started) {
            const ctx = getWebAudioContext()
            if (bufferRef.current) {
                offsetRef.current = Math.min(
                    bufferRef.current.duration,
                    Math.max(0, ctx.currentTime - startCtxTimeRef.current)
                )
            }
            current.node.stop()
        }
    }

    const start = (offsetSeconds: number) => {
        const buffer = bufferRef.current
        // Si un start() tourne déjà, on l'ignore plutôt que de le remplacer,
        // sinon on aurait deux sons qui se chevauchent.
        if (!buffer || activeRef.current) return

        const clamped = Math.min(Math.max(offsetSeconds, 0), Math.max(0, buffer.duration - 0.05))
        const ctx = getWebAudioContext()
        const node = ctx.createBufferSource()
        node.buffer = buffer
        node.connect(ctx.destination)
        node.onended = () => {
            activeRef.current = null
            setPlaying(false)
            setDidJustFinish(true)
        }

        const current: ActiveSource = { node, started: false }
        activeRef.current = current
        offsetRef.current = clamped
        setPlaying(true)
        setDidJustFinish(false)

        resumeWebAudioContext().finally(() => {
            if (activeRef.current !== current) return // déjà arrêté ou remplacé entre-temps
            current.started = true
            startCtxTimeRef.current = ctx.currentTime - clamped
            node.start(0, clamped)
        })
    }

    // Chargement de l'extrait. Contrairement au natif, decodeAudioData() ne
    // laisse rien lire avant d'avoir fini, donc pas de timeout de secours ici.
    useEffect(() => {
        setIsLoaded(false)
        setDidJustFinish(false)
        bufferRef.current = null
        offsetRef.current = 0
        syncedForUrlRef.current = undefined
        stop()

        if (!previewUrl) return

        let cancelled = false
        loadBuffer(previewUrl)
            .then((buffer) => {
                if (cancelled) return
                bufferRef.current = buffer
                setIsLoaded(true)
            })
            .catch((err) => {
                console.error('❌ Échec du chargement de l\'extrait (web) :', err)
            })

        return () => {
            cancelled = true
        }
    }, [previewUrl])

    // Synchro sur startedAt, même logique que la version native.
    useEffect(() => {
        if (!autoPlay || !isLoaded || syncedForUrlRef.current === previewUrl) return

        let innerTimeout: ReturnType<typeof setTimeout> | undefined

        const attemptSyncedPlay = () => {
            if (syncedForUrlRef.current === previewUrl) return

            if (startedAt === undefined) {
                syncedForUrlRef.current = previewUrl
                start(0)
                return
            }

            const delayMs = startedAt - Date.now()
            if (delayMs <= 0) {
                syncedForUrlRef.current = previewUrl
                start(-delayMs / 1000)
                return
            }

            innerTimeout = setTimeout(() => {
                syncedForUrlRef.current = previewUrl
                start(0)
            }, delayMs)
        }

        attemptSyncedPlay()

        return () => {
            if (innerTimeout) clearTimeout(innerTimeout)
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isLoaded, startedAt, previewUrl])

    // Nettoyage à la vraie sortie de la manche (le lecteur reste monté entre question et résultat).
    useEffect(() => {
        return () => stop()
    }, [])

    const play = () => {
        if (activeRef.current) return
        start(offsetRef.current)
    }

    const seekTo = (seconds: number): Promise<void> => {
        stop()
        const buffer = bufferRef.current
        offsetRef.current = buffer ? Math.min(Math.max(seconds, 0), Math.max(0, buffer.duration - 0.05)) : Math.max(seconds, 0)
        return Promise.resolve()
    }

    const toggle = () => {
        if (activeRef.current) stop()
        else play()
    }

    return {
        player: { play, pause: stop, seekTo },
        status: { playing, isLoaded, didJustFinish },
        toggle,
    }
}
