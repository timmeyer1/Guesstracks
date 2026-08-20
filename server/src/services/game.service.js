import {
    QUESTION_TYPES,
    SCORING,
    PHASE_DURATIONS,
    ROUND_RESULTS_PAUSE_MS,
    MIN_ROUNDS_PLAYABLE,
    LOBBY_LIMITS,
} from '../constants.js'
import { resolvePreviewUrl } from './preview.service.js'

export class GameError extends Error {
    constructor(message, status = 400) {
        super(message)
        this.status = status
    }
}

// État de partie en mémoire, par code de lobby. Contrairement au lobby (dont
// l'API REST est la source de vérité, cf. sockets/index.js), une partie est un
// flux temps réel piloté par des timers serveur : le socket est ici la seule
// source de vérité, ce qui est le bon compromis pour un état éphémère qui ne
// doit de toute façon pas survivre au redémarrage du process.
const games = new Map()

const room = (code) => `lobby:${code}`

const emptyScore = () => ({
    total: 0,
    streak: 0,
    bestStreak: 0,
    correctRounds: 0,
    perfectRounds: 0,
    fastestMs: null,
})

const getOrCreate = (code) => {
    let game = games.get(code)
    if (!game) {
        game = {
            code,
            status: 'collecting', // collecting -> in_round -> round_result -> ... -> finished
            submittedTracks: new Map(), // playerId -> track[]
            playersInfo: new Map(), // playerId -> { id, name, img }
            activePlayerIds: [],
            scores: new Map(), // playerId -> score
            gameMode: null,
            phaseSpeed: null,
            rounds: [],
            currentRoundIndex: -1,
            timer: null,
        }
        games.set(code, game)
    }
    return game
}

const shuffle = (items) => {
    const copy = [...items]
    for (let i = copy.length - 1; i > 0; i -= 1) {
        const j = Math.floor(Math.random() * (i + 1))
        ;[copy[i], copy[j]] = [copy[j], copy[i]]
    }
    return copy
}

export const submitTracks = (code, player, tracks) => {
    if (!player || typeof player.id !== 'string' || !player.id.trim()) {
        throw new GameError('Joueur invalide')
    }

    const game = getOrCreate(code)
    // partie déjà lancée : un envoi tardif (reconnexion, etc.) est ignoré,
    // le pool a déjà été figé au démarrage
    if (game.status !== 'collecting') return { accepted: false }

    game.playersInfo.set(player.id, {
        id: player.id,
        name: player.name,
        img: player.img ?? null,
    })

    const sanitized = Array.isArray(tracks)
        ? tracks
              .filter((t) => t && typeof t.id === 'string' && typeof t.name === 'string' && typeof t.artist === 'string')
              .slice(0, 500)
              .map((t) => ({
                  id: t.id,
                  name: t.name,
                  artist: t.artist,
                  album: typeof t.album === 'string' ? t.album : '',
                  image: typeof t.image === 'string' ? t.image : null,
                  previewUrl: typeof t.previewUrl === 'string' ? t.previewUrl : null,
              }))
        : []

    game.submittedTracks.set(player.id, sanitized)
    if (!game.scores.has(player.id)) game.scores.set(player.id, emptyScore())

    return { accepted: true }
}

const buildPool = (game) => {
    const merged = new Map() // trackId -> track + Set<playerId>

    for (const [playerId, tracks] of game.submittedTracks) {
        for (const track of tracks) {
            const existing = merged.get(track.id)
            if (existing) {
                existing.likedBy.add(playerId)
                if (!existing.previewUrl && track.previewUrl) existing.previewUrl = track.previewUrl
            } else {
                merged.set(track.id, { ...track, likedBy: new Set([playerId]) })
            }
        }
    }

    return [...merged.values()]
}

// mode guesstracks : le titre est toujours affiché (ce n'est pas ce qu'on
// devine), on privilégie juste les musiques qui ont un extrait sans que ce
// soit bloquant
const buildGuesstracksRounds = async (pool, requestedRounds, activePlayerIds) => {
    const candidates = shuffle(pool)
    const withPreview = []
    const withoutPreview = []

    for (const track of candidates) {
        const likedBy = [...track.likedBy].filter((id) => activePlayerIds.includes(id))
        if (likedBy.length === 0) continue

        const previewUrl = await resolvePreviewUrl(track)
        const round = { track: { ...track, previewUrl }, likedBy }
        if (previewUrl) withPreview.push(round)
        else withoutPreview.push(round)

        if (withPreview.length >= requestedRounds) break
    }

    return [...withPreview, ...withoutPreview].slice(0, requestedRounds)
}

// mode blindtest : on devine le titre, donc un extrait est indispensable
const buildBlindtestRounds = async (pool, requestedRounds) => {
    const candidates = shuffle(pool)
    const rounds = []

    for (const track of candidates) {
        if (rounds.length >= requestedRounds) break
        const previewUrl = await resolvePreviewUrl(track)
        if (!previewUrl) continue
        rounds.push({ track: { ...track, previewUrl } })
    }

    return rounds.map((round) => {
        const distractorPool = pool.filter((t) => t.id !== round.track.id)
        const distractors = shuffle(distractorPool).slice(0, 3)
        const options = shuffle([
            { id: round.track.id, label: `${round.track.name} — ${round.track.artist}` },
            ...distractors.map((t) => ({ id: t.id, label: `${t.name} — ${t.artist}` })),
        ])
        return { ...round, options }
    })
}

const publicRound = (game, round) => {
    const hideIdentity = round.questionType === 'guess_track'
    return {
        roundIndex: round.index,
        totalRounds: game.rounds.length,
        questionType: round.questionType,
        options: round.options,
        duration: round.duration,
        startedAt: round.startedAt,
        track: hideIdentity
            ? { id: round.track.id, previewUrl: round.track.previewUrl }
            : {
                  id: round.track.id,
                  name: round.track.name,
                  artist: round.track.artist,
                  album: round.track.album,
                  image: round.track.image,
                  previewUrl: round.track.previewUrl,
              },
    }
}

const buildLeaderboard = (game) =>
    game.activePlayerIds
        .map((id) => {
            const info = game.playersInfo.get(id)
            const score = game.scores.get(id) ?? emptyScore()
            return {
                playerId: id,
                name: info?.name ?? '???',
                img: info?.img ?? null,
                total: score.total,
                streak: score.streak,
                bestStreak: score.bestStreak,
                correctRounds: score.correctRounds,
                perfectRounds: score.perfectRounds,
            }
        })
        .sort((a, b) => b.total - a.total || b.bestStreak - a.bestStreak)

export const startGame = async ({ code, playerId, lobby, io }) => {
    const game = getOrCreate(code)
    if (game.status !== 'collecting') {
        throw new GameError('La partie est déjà lancée')
    }

    const hostId = lobby.players[0]?.id
    if (hostId !== playerId) {
        throw new GameError("Seul l'hôte peut lancer la partie", 403)
    }
    if (lobby.players.length < LOBBY_LIMITS.MIN_PLAYERS_TO_START) {
        throw new GameError('Il faut au moins 2 joueurs pour lancer la partie')
    }

    const activePlayerIds = lobby.players.map((p) => p.id)
    for (const p of lobby.players) {
        game.playersInfo.set(p.id, { id: p.id, name: p.name, img: p.img ?? null })
        if (!game.scores.has(p.id)) game.scores.set(p.id, emptyScore())
    }
    game.activePlayerIds = activePlayerIds
    game.gameMode = lobby.gameMode
    game.phaseSpeed = lobby.phaseSpeed

    const pool = buildPool(game)
    if (pool.length === 0) {
        throw new GameError("Aucun titre liké n'a été reçu, impossible de lancer la partie")
    }

    const questionType = QUESTION_TYPES[game.gameMode]
    const built =
        questionType === 'who_liked'
            ? await buildGuesstracksRounds(pool, lobby.rounds, activePlayerIds)
            : await buildBlindtestRounds(pool, lobby.rounds)

    if (built.length < MIN_ROUNDS_PLAYABLE) {
        throw new GameError(
            questionType === 'guess_track'
                ? 'Pas assez de musiques avec un extrait disponible pour lancer un blindtest'
                : 'Pas assez de musiques likées en commun pour lancer une partie'
        )
    }

    game.rounds = built.map((r, index) => ({
        index,
        track: r.track,
        questionType,
        options: questionType === 'who_liked' ? activePlayerIds.map((id) => game.playersInfo.get(id)) : r.options,
        correctAnswerIds: questionType === 'who_liked' ? r.likedBy : [r.track.id],
        duration: PHASE_DURATIONS[game.phaseSpeed],
        startedAt: null,
        answers: new Map(),
    }))
    game.currentRoundIndex = -1

    io.to(room(code)).emit('game:started', {
        totalRounds: game.rounds.length,
        gameMode: game.gameMode,
    })

    startNextRound(code, io)
}

const startNextRound = (code, io) => {
    const game = games.get(code)
    if (!game) return

    game.currentRoundIndex += 1
    const round = game.rounds[game.currentRoundIndex]

    if (!round) {
        finishGame(code, io)
        return
    }

    game.status = 'in_round'
    round.startedAt = Date.now()
    round.answers = new Map()

    io.to(room(code)).emit('game:round:start', publicRound(game, round))

    clearTimeout(game.timer)
    game.timer = setTimeout(() => endRound(code, io), round.duration * 1000)
}

export const submitAnswer = ({ code, playerId, roundIndex, selected, io }) => {
    const game = games.get(code)
    if (!game || game.status !== 'in_round') return null

    const round = game.rounds[game.currentRoundIndex]
    if (!round || round.index !== roundIndex) return null
    if (!game.activePlayerIds.includes(playerId)) return null
    if (round.answers.has(playerId)) return null

    const selectedIds = Array.isArray(selected)
        ? [...new Set(selected)].filter((id) => typeof id === 'string')
        : []
    const elapsedMs = Math.max(0, Date.now() - round.startedAt)

    round.answers.set(playerId, { selectedIds, elapsedMs })

    const allAnswered = game.activePlayerIds.every((id) => round.answers.has(id))
    if (allAnswered) {
        endRound(code, io)
    }

    return { allAnswered }
}

const endRound = (code, io) => {
    const game = games.get(code)
    if (!game || game.status !== 'in_round') return
    clearTimeout(game.timer)
    game.timer = null
    game.status = 'round_result'

    const round = game.rounds[game.currentRoundIndex]
    const correctSet = new Set(round.correctAnswerIds)
    const results = []

    for (const playerId of game.activePlayerIds) {
        const score = game.scores.get(playerId) ?? emptyScore()
        const answer = round.answers.get(playerId)
        const selectedIds = answer?.selectedIds ?? []
        const elapsedMs = answer ? answer.elapsedMs : round.duration * 1000

        const correctSelected = selectedIds.filter((id) => correctSet.has(id)).length
        const incorrectSelected = selectedIds.filter((id) => !correctSet.has(id)).length
        // une seule personne cochée à tort annule les points de la manche, même
        // si le reste de la sélection était correct
        const hasWrongPick = incorrectSelected > 0
        const recall = correctSet.size > 0 ? correctSelected / correctSet.size : 0
        const earnedPoints = !hasWrongPick && recall > 0
        const isPerfect = !hasWrongPick && recall === 1 && selectedIds.length > 0

        const speedFactor = Math.max(SCORING.MIN_SPEED_FACTOR, 1 - elapsedMs / (round.duration * 1000))

        // plus on identifie de bonnes réponses (sans erreur), plus le score se
        // rapproche du maximum : une seule bonne personne sur plusieurs ne
        // rapporte qu'une fraction des points, toutes les rapporte en entier
        let points = earnedPoints ? Math.round(SCORING.BASE_POINTS * recall * speedFactor) : 0

        if (isPerfect) {
            score.streak += 1
            score.bestStreak = Math.max(score.bestStreak, score.streak)
            score.perfectRounds += 1
            const streakLevel = Math.max(0, score.streak - 1)
            points += Math.min(SCORING.STREAK_BONUS_CAP, streakLevel * SCORING.STREAK_BONUS_PER_LEVEL)
            points += SCORING.PERFECT_BONUS
        } else {
            score.streak = 0
        }

        points = Math.max(0, points)
        if (earnedPoints) score.correctRounds += 1
        if (isPerfect && (score.fastestMs === null || elapsedMs < score.fastestMs)) {
            score.fastestMs = elapsedMs
        }

        score.total += points
        game.scores.set(playerId, score)

        results.push({
            playerId,
            selectedIds,
            answered: Boolean(answer),
            elapsedMs: answer ? elapsedMs : null,
            correctSelected,
            incorrectSelected,
            isPerfect,
            points,
            totalPoints: score.total,
            streak: score.streak,
        })
    }

    io.to(room(code)).emit('game:round:end', {
        roundIndex: round.index,
        correctAnswerIds: round.correctAnswerIds,
        track: {
            id: round.track.id,
            name: round.track.name,
            artist: round.track.artist,
            album: round.track.album,
            image: round.track.image,
        },
        results,
        leaderboard: buildLeaderboard(game),
    })

    game.timer = setTimeout(() => startNextRound(code, io), ROUND_RESULTS_PAUSE_MS)
}

const finishGame = (code, io) => {
    const game = games.get(code)
    if (!game) return
    clearTimeout(game.timer)
    game.timer = null
    game.status = 'finished'

    const totalRounds = game.rounds.length
    const leaderboard = buildLeaderboard(game).map((entry) => {
        const score = game.scores.get(entry.playerId) ?? emptyScore()
        return {
            ...entry,
            accuracy: totalRounds > 0 ? Math.round((score.correctRounds / totalRounds) * 100) : 0,
            fastestMs: score.fastestMs,
        }
    })

    io.to(room(code)).emit('game:end', { leaderboard, totalRounds })
}

// snapshot envoyé à un client qui (re)rejoint la room en cours de partie
export const getSnapshot = (code) => {
    const game = games.get(code)
    if (!game) return { status: 'idle' }

    if (game.status === 'collecting' || game.status === 'finished') {
        return { status: game.status }
    }

    const round = game.rounds[game.currentRoundIndex]
    if (game.status === 'in_round' && round) {
        return { status: 'in_round', round: publicRound(game, round) }
    }

    return {
        status: 'round_result',
        roundIndex: round?.index ?? null,
        totalRounds: game.rounds.length,
        leaderboard: buildLeaderboard(game),
    }
}

export const cleanupGame = (code) => {
    const game = games.get(code)
    if (game) clearTimeout(game.timer)
    games.delete(code)
}
