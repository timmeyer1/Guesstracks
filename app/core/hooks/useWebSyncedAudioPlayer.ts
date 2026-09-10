// app/core/hooks/useWebSyncedAudioPlayer.ts
//
// Implémentation web de useSyncedAudioPlayer (cf. ce fichier pour le dispatch) —
// passe par l'AudioContext (Web Audio API) plutôt que par expo-audio :
// expo-audio crée un nouveau <audio> HTMLMediaElement à chaque manche (chaque
// changement de previewUrl), et Safari iOS exige un geste utilisateur pour
// CHAQUE nouvel élément — débloquer une fois au départ ne suffit donc qu'à la
// toute première manche, les suivantes (démarrées via setTimeout pour la
// synchro sur startedAt, jamais un clic direct) restent bloquées, avec une
// NotAllowedError en boucle (confirmé en conditions réelles sur iPhone,
// Android/Chrome n'étant lui pas concerné par cette restriction par élément).
// Un AudioContext débloqué une seule fois (cf. webAudioUnlock.ts) reste lui
// valide pour toutes les lectures qu'on y programme ensuite, quel que soit le
// nombre d'extraits différents ou le moment de démarrage.
import { useEffect, useRef, useState } from 'react'
import { getWebAudioContext, resumeWebAudioContext } from '../webAudioUnlock'
import type { SyncedAudioPlayer, UseSyncedAudioPlayerOptions } from './useSyncedAudioPlayer.types'

// Cache des buffers décodés par URL : évite de re-télécharger/décoder le même
// extrait s'il revient (reconnexion, manche déjà entendue).
const bufferCache = new Map<string, Promise<AudioBuffer>>()

const loadBuffer = (url: string): Promise<AudioBuffer> => {
    const cached = bufferCache.get(url)
    if (cached) return cached

    const promise = fetch(url)
        .then((res) => res.arrayBuffer())
        .then((data) => getWebAudioContext().decodeAudioData(data))
    // un échec ne doit pas rester en cache indéfiniment (ex: souci réseau
    // ponctuel) : la prochaine tentative sur cette URL repart de zéro
    promise.catch(() => bufferCache.delete(url))
    bufferCache.set(url, promise)
    return promise
}

type ActiveSource = {
    node: AudioBufferSourceNode
    // `node.start()` n'a peut-être pas encore été réellement appelé (en
    // attente de resumeWebAudioContext(), cf. start() plus bas) — appeler
    // stop() sur un node jamais démarré lève une InvalidStateError.
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
    // position (secondes) d'où repartir au prochain démarrage — mise à jour à
    // chaque pause/seek, jamais pendant la lecture (pas besoin d'afficher une
    // progression, cf. SyncedAudioPlayer)
    const offsetRef = useRef(0)
    const startCtxTimeRef = useRef(0)
    // comme dans useNativeSyncedAudioPlayer : ce rattrapage sur startedAt ne
    // doit se déclencher qu'une seule fois par extrait chargé
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
        // un start() déjà en cours (activeRef non nul) est ignoré plutôt que
        // remplacé : évite deux sources qui se chevauchent si play()/toggle()
        // est appelé deux fois de suite avant que le premier ait fini de
        // s'installer (cf. le délai de resumeWebAudioContext() ci-dessous)
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
            if (activeRef.current !== current) return // arrêté/remplacé entre-temps
            current.started = true
            startCtxTimeRef.current = ctx.currentTime - clamped
            node.start(0, clamped)
        })
    }

    // chargement de l'extrait : contrairement à un <audio> qui bufferise
    // progressivement (d'où le FORCE_PLAY_TIMEOUT_MS côté natif, pour ne pas
    // attendre indéfiniment isLoaded), decodeAudioData() ne laisse rien à lire
    // avant d'avoir fini — pas d'équivalent utile ici.
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

    // synchro sur startedAt : même logique que useNativeSyncedAudioPlayer
    // (cf. ce fichier pour le détail de pourquoi syncedForUrlRef n'est marqué
    // qu'au moment où le démarrage est réellement déclenché, jamais avant).
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

    // nettoyage à la vraie sortie de l'écran de manche (le lecteur reste monté
    // entre question et résultat, cf. useNativeSyncedAudioPlayer)
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
