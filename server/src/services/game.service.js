import {
    QUESTION_TYPES,
    SCORING,
    PHASE_DURATIONS,
    ROUND_RESULTS_PAUSE_MS,
    MIN_ROUNDS_PLAYABLE,
    LOBBY_LIMITS,
    RETURN_TO_LOBBY_TIMEOUT_MS,
} from '../constants.js'
import { resolvePreviewUrl, normalizeTrackText } from './preview.service.js'
import * as lobbyService from './lobby.service.js'

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
            // ids des joueurs de la partie qui vient de se terminer, encore
            // attendus au lobby avant de pouvoir relancer (cf. finishGame /
            // clearPendingReturn) ; vide/absent hors de cette fenêtre d'attente
            pendingReturnPlayerIds: null,
            returnTimer: null,
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

export const submitTracks = (code, player, tracks, io) => {
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

    // permet au lobby d'afficher qui a déjà envoyé ses musiques (et de bloquer
    // "Lancer la partie" tant que ce n'est pas le cas pour tout le monde,
    // cf. startGame) : sans ça, un lancement trop rapide après qu'un joueur
    // vient de rejoindre pouvait démarrer avec un pool incomplet — c'était la
    // cause la plus probable des musiques "toutes du même joueur" ou des
    // manches où un seul des vrais likers apparaissait comme bonne réponse
    io?.to(room(code)).emit('game:tracksProgress', {
        submittedPlayerIds: [...game.submittedTracks.keys()],
    })

    return { accepted: true }
}

// un même morceau existe parfois sous plusieurs id différents chez un même
// fournisseur (single vs édition album, remaster...) — ex. constaté chez
// Deezer : "Fever" de Dua Lipa a un id pour le single et un autre pour
// l'édition "Future Nostalgia (The Moonlight Edition)" de l'album. Regrouper
// par id fournisseur laissait passer ces doublons jusque dans le catalogue de
// recherche du blindtest (le même titre apparaissait deux fois) ; on
// regroupe donc par identité normalisée (nom + artiste) plutôt que par id.
const poolKey = (track) => `${normalizeTrackText(track.name)}::${normalizeTrackText(track.artist)}`

const buildPool = (game) => {
    const merged = new Map() // clé "nom::artiste" normalisée -> track + Set<playerId>

    for (const [playerId, tracks] of game.submittedTracks) {
        for (const track of tracks) {
            const key = poolKey(track)
            const existing = merged.get(key)
            if (existing) {
                existing.likedBy.add(playerId)
                if (!existing.previewUrl && track.previewUrl) existing.previewUrl = track.previewUrl
            } else {
                merged.set(key, { ...track, likedBy: new Set([playerId]) })
            }
        }
    }

    return [...merged.values()]
}

// trie une liste de titres mélangée par nombre décroissant de joueurs actifs
// qui les ont likés : un titre partagé par plusieurs joueurs couvre plusieurs
// joueurs d'un coup, donc l'essayer en premier évite de gaspiller le budget de
// manches sur des titres qui n'en couvrent qu'un seul (le mélange en amont
// sert de départage aléatoire entre titres à égalité de couverture)
const byCoverageDesc = (shuffledPool, activePlayerIds) =>
    [...shuffledPool].sort((a, b) => {
        const countA = [...a.likedBy].filter((id) => activePlayerIds.includes(id)).length
        const countB = [...b.likedBy].filter((id) => activePlayerIds.includes(id)).length
        return countB - countA
    })

// mode guesstracks : le titre est toujours affiché (ce n'est pas ce qu'on
// devine), on privilégie juste les musiques qui ont un extrait sans que ce
// soit bloquant.
//
// Équité : une première passe (triée par couverture, cf. byCoverageDesc)
// réserve un titre par joueur pas encore représenté ; ces manches "d'équité"
// sont ensuite toujours conservées telles quelles. Une seconde passe complète
// les manches restantes avec le reste du pool mélangé, en privilégiant les
// titres avec extrait comme avant — donc plus il y a de manches, plus les
// joueurs ont de chances de voir plusieurs de leurs titres tirés.
const buildGuesstracksRounds = async (pool, requestedRounds, activePlayerIds) => {
    const shuffledPool = shuffle(pool)
    const used = new Set()
    const fairnessRounds = []
    const uncovered = new Set(activePlayerIds)

    const buildRound = async (track) => {
        const likedBy = [...track.likedBy].filter((id) => activePlayerIds.includes(id))
        if (likedBy.length === 0) return null
        const previewUrl = await resolvePreviewUrl(track)
        return { round: { track: { ...track, previewUrl }, likedBy }, previewUrl, likedBy }
    }

    for (const track of byCoverageDesc(shuffledPool, activePlayerIds)) {
        if (fairnessRounds.length >= requestedRounds || uncovered.size === 0) break
        if (![...track.likedBy].some((id) => uncovered.has(id))) continue

        const result = await buildRound(track)
        if (!result) continue

        used.add(track.id)
        fairnessRounds.push(result.round)
        for (const id of result.likedBy) uncovered.delete(id)
    }

    const remainingSlots = requestedRounds - fairnessRounds.length
    const withPreview = []
    const withoutPreview = []

    for (const track of shuffledPool) {
        if (withPreview.length >= remainingSlots) break
        if (used.has(track.id)) continue

        const result = await buildRound(track)
        if (!result) continue

        used.add(track.id)
        ;(result.previewUrl ? withPreview : withoutPreview).push(result.round)
    }

    return [...fairnessRounds, ...withPreview, ...withoutPreview].slice(0, requestedRounds)
}

// mode blindtest : on devine le titre, donc un extrait est indispensable.
// Même logique d'équité que buildGuesstracksRounds (une passe d'équité dont
// les manches sont toujours conservées, puis une passe de remplissage), mais
// l'extrait est requis dès la première passe (pas de repli "sans extrait" ici).
const buildBlindtestRounds = async (pool, requestedRounds, activePlayerIds) => {
    const shuffledPool = shuffle(pool)
    const used = new Set()
    const fairnessRounds = []
    const uncovered = new Set(activePlayerIds)

    for (const track of byCoverageDesc(shuffledPool, activePlayerIds)) {
        if (fairnessRounds.length >= requestedRounds || uncovered.size === 0) break
        const likedBy = [...track.likedBy].filter((id) => activePlayerIds.includes(id))
        if (!likedBy.some((id) => uncovered.has(id))) continue

        const previewUrl = await resolvePreviewUrl(track)
        if (!previewUrl) continue

        used.add(track.id)
        fairnessRounds.push({ track: { ...track, previewUrl } })
        for (const id of likedBy) uncovered.delete(id)
    }

    const remainingSlots = requestedRounds - fairnessRounds.length
    const rounds = []

    for (const track of shuffledPool) {
        if (rounds.length >= remainingSlots) break
        if (used.has(track.id)) continue

        const previewUrl = await resolvePreviewUrl(track)
        if (!previewUrl) continue

        used.add(track.id)
        rounds.push({ track: { ...track, previewUrl } })
    }

    return [...fairnessRounds, ...rounds]
}

// catalogue de recherche du blindtest : tous les titres likés par le lobby,
// envoyé une seule fois (le joueur cherche dedans plutôt que de choisir parmi
// des options imposées)
const buildCatalog = (pool) => pool.map((t) => ({ id: t.id, name: t.name, artist: t.artist }))

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
            ? { id: round.track.id, previewUrl: round.track.previewUrl, image: round.track.image }
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
    // une partie terminée peut être relancée (rejouer sans quitter le lobby) :
    // les joueurs n'ont pas besoin de renvoyer leurs titres likés, seuls les
    // scores et les manches repartent de zéro
    if (!['collecting', 'finished'].includes(game.status)) {
        throw new GameError('La partie est déjà lancée')
    }

    const hostId = lobby.players[0]?.id
    if (hostId !== playerId) {
        throw new GameError("Seul l'hôte peut lancer la partie", 403)
    }
    if (lobby.players.length < LOBBY_LIMITS.MIN_PLAYERS_TO_START) {
        throw new GameError('Il faut au moins 2 joueurs pour lancer la partie')
    }
    // relancer trop vite après la fin d'une partie pouvait laisser des joueurs
    // coincés sur l'écran de résultats précédent, hors sync avec la nouvelle
    // partie : on attend que chacun ait explicitement donné signe de vie (soit
    // revenu au lobby, soit quitté) — cf. finishGame / clearPendingReturn
    if (game.pendingReturnPlayerIds && game.pendingReturnPlayerIds.size > 0) {
        throw new GameError(
            game.pendingReturnPlayerIds.size === 1
                ? "En attente qu'un joueur revienne au lobby avant de relancer"
                : `En attente que ${game.pendingReturnPlayerIds.size} joueurs reviennent au lobby avant de relancer`
        )
    }
    clearTimeout(game.returnTimer)
    game.returnTimer = null

    if (game.status === 'finished') {
        game.scores = new Map()
    }

    const activePlayerIds = lobby.players.map((p) => p.id)

    // évite de démarrer avec un pool incomplet (ex: un joueur vient tout
    // juste de rejoindre et son envoi de musiques likées n'est pas encore
    // arrivé) : sans cette garde, le pool ne reflétait parfois qu'une partie
    // des joueurs, silencieusement
    const missingSubmissions = activePlayerIds.filter((id) => !game.submittedTracks.has(id))
    if (missingSubmissions.length > 0) {
        throw new GameError(
            missingSubmissions.length === 1
                ? "En attente des musiques likées d'un joueur avant de lancer la partie"
                : `En attente des musiques likées de ${missingSubmissions.length} joueurs avant de lancer la partie`
        )
    }

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
            : await buildBlindtestRounds(pool, lobby.rounds, activePlayerIds)

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
        options: questionType === 'who_liked' ? activePlayerIds.map((id) => game.playersInfo.get(id)) : [],
        correctAnswerIds: questionType === 'who_liked' ? r.likedBy : [r.track.id],
        duration: PHASE_DURATIONS[game.phaseSpeed],
        startedAt: null,
        answers: new Map(),
    }))
    game.currentRoundIndex = -1

    io.to(room(code)).emit('game:started', {
        totalRounds: game.rounds.length,
        gameMode: game.gameMode,
        catalog: questionType === 'guess_track' ? buildCatalog(pool) : undefined,
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
        const basePoints = earnedPoints ? Math.round(SCORING.BASE_POINTS * recall * speedFactor) : 0
        let bonusPoints = 0

        if (isPerfect) {
            score.streak += 1
            score.bestStreak = Math.max(score.bestStreak, score.streak)
            score.perfectRounds += 1
            const streakLevel = Math.max(0, score.streak - 1)
            bonusPoints += Math.min(SCORING.STREAK_BONUS_CAP, streakLevel * SCORING.STREAK_BONUS_PER_LEVEL)
            bonusPoints += SCORING.PERFECT_BONUS
        } else {
            score.streak = 0
        }

        const points = Math.max(0, basePoints + bonusPoints)
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
            basePoints,
            bonusPoints,
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

    startReturnWaiting(code, io)
}

const broadcastReturnProgress = (code, io, game) => {
    io.to(room(code)).emit('game:returnProgress', {
        pendingPlayerIds: [...(game.pendingReturnPlayerIds ?? [])],
    })
}

// ouvre la fenêtre d'attente de RETURN_TO_LOBBY_TIMEOUT_MS après la fin d'une
// partie : chaque joueur doit soit revenir au lobby (clearPendingReturn),
// soit le quitter (ce qui le retire de activePlayerIds côté lobby ailleurs) ;
// passé ce délai, ceux qui n'ont toujours pas donné signe de vie sont expulsés
const startReturnWaiting = (code, io) => {
    const game = games.get(code)
    if (!game) return

    game.pendingReturnPlayerIds = new Set(game.activePlayerIds)
    clearTimeout(game.returnTimer)
    broadcastReturnProgress(code, io, game)

    if (game.pendingReturnPlayerIds.size === 0) return

    game.returnTimer = setTimeout(() => {
        handleReturnTimeout(code, io).catch((err) => {
            console.error('Erreur lors du nettoyage des joueurs inactifs :', err)
        })
    }, RETURN_TO_LOBBY_TIMEOUT_MS)
}

const handleReturnTimeout = async (code, io) => {
    const game = games.get(code)
    if (!game || !game.pendingReturnPlayerIds || game.pendingReturnPlayerIds.size === 0) return

    const inactiveIds = [...game.pendingReturnPlayerIds]
    game.pendingReturnPlayerIds = new Set()
    game.returnTimer = null

    for (const playerId of inactiveIds) {
        game.activePlayerIds = game.activePlayerIds.filter((id) => id !== playerId)
        const lobby = await lobbyService.removePlayer(code, playerId)
        if (lobby) {
            io.to(room(code)).emit('lobby:update', lobby)
        }
    }

    broadcastReturnProgress(code, io, game)
}

// sort un joueur de la liste d'attente de retour (cf. startReturnWaiting) —
// appelé soit quand il (re)arrive sur l'écran de lobby, soit quand il quitte
// le lobby ou en est expulsé entre-temps (lobby.routes.js) : dans les deux
// cas il n'y a plus lieu de l'attendre. Débloque "Lancer la partie" côté
// hôte une fois tout le monde revenu ou parti.
// Rediffuse systématiquement l'état courant (même quand playerId n'y était
// déjà plus, ex: expulsé pour inactivité) : c'est ce qui permet à un client
// dont l'état local est périmé (ex: un joueur qui a été expulsé puis revenu,
// et redevenu hôte) de se resynchroniser — sinon "En attente qu'un joueur
// revienne au lobby" pouvait rester bloqué indéfiniment.
export const clearPendingReturn = (code, playerId, io) => {
    const game = games.get(code)
    if (!game || !game.pendingReturnPlayerIds) return

    const wasPending = game.pendingReturnPlayerIds.delete(playerId)
    broadcastReturnProgress(code, io, game)

    if (wasPending && game.pendingReturnPlayerIds.size === 0) {
        clearTimeout(game.returnTimer)
        game.returnTimer = null
    }
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
