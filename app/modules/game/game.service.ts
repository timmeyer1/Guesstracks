import { useAuthStore } from '../../stores/auth.store'
import { useLobbyStore } from '../../stores/lobby.store'
import { useGameStore } from '../../stores/game.store'
import { useTrackStore } from '../../stores/tracks.store'
import {
    subscribeToGame,
    emitSubmitTracks,
    emitStartGame,
    emitAnswer,
    emitGameSync,
    emitConfirmReturn,
    emitNextRound,
    emitReportWrongPreview,
    type GameStatePayload,
} from '../../core/socket'
import type { GameRoundStart, GameRoundEnd, GameEnd, GameStarted } from '../../core/types'

let unsubscribeGame: (() => void) | null = null

const buildPlayerPayload = () => {
    const { user } = useAuthStore.getState()
    if (!user) return null
    return {
        id: user.id,
        name: user.display_name,
        img: user.img || null,
        accountType: user.account_type || null,
    }
}

const applySnapshot = (payload: GameStatePayload) => {
    const store = useGameStore.getState()

    switch (payload.status) {
        case 'in_round':
            store.startRound(payload.round)
            break
        case 'round_result':
            store.setPhase('round_result')
            store.setTotalRounds(payload.totalRounds)
            store.setLeaderboard(payload.leaderboard)
            break
        case 'finished':
            store.setPhase('finished')
            break
        case 'collecting':
            store.setPhase('collecting')
            break
        default:
            break
    }
}

// écoute les événements de jeu pour toute la durée du lobby : à appeler dès
// l'entrée dans l'écran de lobby, avant même que la partie démarre, pour ne
// rater ni "game:started" ni le premier "game:round:start"
export const startWatchingGame = () => {
    stopWatchingGame()

    unsubscribeGame = subscribeToGame({
        onStarted: (payload: GameStarted) => {
            // état transitoire : le pool est prêt, le premier "round:start" arrive
            // dans la foulée
            useGameStore.getState().setPhase('collecting')
            useGameStore.getState().setGameMode(payload.gameMode)
            useGameStore.getState().setManualAdvance(payload.manualAdvance)
            useGameStore.getState().setTotalRounds(payload.totalRounds)
            useGameStore.getState().setCatalog(payload.catalog ?? [])
        },
        onRoundStart: (payload: GameRoundStart) => {
            useGameStore.getState().startRound(payload)
        },
        onRoundEnd: (payload: GameRoundEnd) => {
            useGameStore.getState().endRound(payload)
        },
        onEnd: (payload: GameEnd) => {
            useGameStore.getState().setFinal(payload.leaderboard, payload.totalRounds, payload.audioStartedAt)
        },
        onError: (payload) => {
            useGameStore.getState().setError(payload.message)
        },
        onState: applySnapshot,
        onTracksProgress: (payload) => {
            useGameStore.getState().setSubmittedPlayerIds(payload.submittedPlayerIds)
        },
        onCatalogEnriched: (payload) => {
            useGameStore.getState().enrichCatalog(payload.updates)
        },
        onReturnProgress: (payload) => {
            useGameStore.getState().setPendingReturnPlayerIds(payload.pendingPlayerIds)
        },
    })
}

export const stopWatchingGame = () => {
    unsubscribeGame?.()
    unsubscribeGame = null
}

// à appeler en quittant le lobby (la partie ne doit pas survivre après ça)
export const leaveGame = () => {
    stopWatchingGame()
    // remplacement complet (cf. game.store.ts) : plus aucune raison de garder
    // submittedPlayerIds/pendingReturnPlayerIds une fois qu'on quitte pour de bon
    useGameStore.getState().reset()
}

const SUBMIT_TRACKS_RETRY_MS = 1500
const SUBMIT_TRACKS_MAX_ATTEMPTS = 4

// envoie ses titres likés au serveur dès l'entrée dans le lobby, pour que le
// pool soit prêt quand l'hôte lance la partie. Si useTrackStore n'est pas encore
// rempli au moment de l'appel (course possible juste après une connexion),
// réessaie quelques fois plutôt que d'abandonner silencieusement et
// définitivement — un abandon silencieux ici laissait "En attente des
// musiques d'un joueur" bloqué indéfiniment côté hôte, sans qu'aucune
// nouvelle tentative ne soit jamais faite.
export const submitMyTracks = (attempt = 1) => {
    const { lobby } = useLobbyStore.getState()
    const player = buildPlayerPayload()
    const tracks = useTrackStore.getState().likedTracks

    if (!lobby || !player) return

    if (tracks.length === 0) {
        if (attempt >= SUBMIT_TRACKS_MAX_ATTEMPTS) {
            console.warn('⚠️ Aucun titre liké disponible après plusieurs tentatives, envoi abandonné')
            return
        }
        setTimeout(() => submitMyTracks(attempt + 1), SUBMIT_TRACKS_RETRY_MS)
        return
    }

    emitSubmitTracks(lobby.code, player, tracks)
}

export const startGame = () => {
    const { lobby } = useLobbyStore.getState()
    const { user } = useAuthStore.getState()
    if (!lobby || !user) return
    emitStartGame(lobby.code)
}

export const submitAnswer = (selected: string[]) => {
    const { lobby } = useLobbyStore.getState()
    const { user } = useAuthStore.getState()
    const { round, hasAnswered } = useGameStore.getState()
    if (!lobby || !user || !round || hasAnswered) return

    useGameStore.getState().setHasAnswered(true)
    emitAnswer(lobby.code, round.roundIndex, selected)
}

// n'a d'effet que si le lobby a activé "avancer manuellement" (cf.
// useGameStore().manualAdvance) et que l'appelant est bien l'hôte — le
// serveur revalide les deux de toute façon (cf. advanceRound, game.service.js)
export const advanceRound = () => {
    const { lobby } = useLobbyStore.getState()
    if (!lobby) return
    emitNextRound(lobby.code)
}

// bouton "Pas le bon extrait ?" de l'écran de résultat (cf. RoundResult.tsx) :
// n'a aucun effet sur la manche déjà jouée, alimente seulement la base de
// correspondances vérifiées côté serveur pour les résolutions futures (cf.
// server/src/services/previewMatch.service.js)
export const reportWrongPreview = (roundIndex: number) => {
    const { lobby } = useLobbyStore.getState()
    if (!lobby) return
    emitReportWrongPreview(lobby.code, roundIndex)
}

// à appeler après une reconnexion pour rattraper l'état de partie en cours
export const syncGame = () => {
    const { lobby } = useLobbyStore.getState()
    if (!lobby) return
    emitGameSync(lobby.code)
}

// à appeler à chaque fois que l'écran de lobby regagne le focus : signale au
// serveur que ce joueur est bien de retour, ce qui débloque "Lancer la
// partie" côté hôte une fois que tout le monde l'a fait (cf. lobby.screen.tsx)
export const confirmReturnedToLobby = () => {
    const { lobby } = useLobbyStore.getState()
    const { user } = useAuthStore.getState()
    if (!lobby || !user) return
    emitConfirmReturn(lobby.code)
}
