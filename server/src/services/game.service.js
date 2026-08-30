import {
    QUESTION_TYPES,
    SCORING,
    ROUND_RESULTS_PAUSE_MS,
    ROUND_ANSWER_GRACE_MS,
    MIN_ROUNDS_PLAYABLE,
    LOBBY_LIMITS,
    RETURN_TO_LOBBY_TIMEOUT_MS,
    AUDIO_SYNC_LEAD_MS,
    POPULAR_TRACK_THRESHOLD,
} from '../constants.js'
import { resolvePreviewUrl, normalizeTrackText } from './preview.service.js'
import { resolveDeezerArtist } from './deezer.service.js'
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

// instant commun (epoch) auquel les clients doivent lancer la lecture d'un
// extrait, avec la même marge de bufferisation que le lancement de manche
// (cf. startNextRound et AUDIO_SYNC_LEAD_MS) — utilisé pour les extraits
// rejoués sur les écrans de résultat de manche / résultats finaux.
const audioSyncedStart = () => Date.now() + AUDIO_SYNC_LEAD_MS

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
            // si true, endRound n'arme pas de timer automatique : seul
            // l'hôte peut passer à la manche suivante (cf. advanceRound)
            manualAdvance: false,
            hostId: null,
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
    // partie déjà lancée (en cours de manche ou entre deux manches) : un envoi
    // tardif (reconnexion, etc.) est ignoré, le pool a déjà été figé au
    // démarrage. 'finished' est en revanche traité comme 'collecting' (même
    // liste de statuts que startGame ci-dessous) : entre la fin d'une partie
    // et le prochain lancement, le statut reste 'finished' tant que l'hôte n'a
    // pas relancé — un nouveau joueur qui rejoint le lobby à ce moment-là (ou
    // un joueur existant qui renvoie ses musiques) doit pouvoir être enregistré
    // dans submittedTracks, sinon il reste invisible du pool et le lancement
    // reste bloqué indéfiniment sur "En attente des musiques d'un joueur",
    // sans qu'aucun changement d'hôte ne puisse le débloquer.
    //
    // On rediffuse quand même l'état courant dans le cas rejeté (même principe
    // que clearPendingReturn pour pendingReturnPlayerIds) : un joueur expulsé
    // pour inactivité en fin de partie (cf. handleReturnTimeout) puis revenu
    // au lobby en retapant le code voit son game store local réinitialisé
    // (cf. lobby.screen.tsx) avant de renvoyer ses musiques ici ; comme il n'a
    // pas besoin de les renvoyer (déjà dans submittedTracks depuis la partie
    // précédente), sans cette rediffusion il n'apprenait jamais que tout le
    // monde avait déjà soumis.
    if (game.status !== 'collecting' && game.status !== 'finished') {
        io?.to(room(code)).emit('game:tracksProgress', {
            submittedPlayerIds: [...game.submittedTracks.keys()],
        })
        return { accepted: false }
    }

    game.playersInfo.set(player.id, {
        id: player.id,
        name: player.name,
        img: player.img ?? null,
    })

    const sanitized = Array.isArray(tracks)
        ? tracks
            .filter((t) => t && typeof t.id === 'string' && typeof t.name === 'string' && typeof t.artist === 'string')
            // garde-fou anti-abus (payload malveillant), pas une limite
            // fonctionnelle : largement au-dessus de ce qu'une vraie
            // bibliothèque likée peut atteindre, pour ne jamais tronquer un
            // vrai joueur (cf. app/modules/spotify|deezer/*.service.ts, qui
            // ne plafonnent plus non plus le nombre de titres récupérés)
            .slice(0, 5000)
            .map((t) => ({
                id: t.id,
                name: t.name,
                artist: t.artist,
                album: typeof t.album === 'string' ? t.album : '',
                image: typeof t.image === 'string' ? t.image : null,
                previewUrl: typeof t.previewUrl === 'string' ? t.previewUrl : null,
                // requis par resolveDeezerArtist (buildCatalog) pour savoir
                // quels titres enrichir avec les artistes en feat. — sans ce
                // champ ici, tous les titres soumis perdaient leur provider
                // et l'enrichissement Deezer ne se déclenchait jamais
                provider: typeof t.provider === 'string' ? t.provider : null,
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
                // ne pioche plus le previewUrl d'une AUTRE soumission ici : deux
                // titres qui dédupliquent sur le même nom+artiste peuvent être
                // des éditions différentes (single vs album, remix...) — piocher
                // l'extrait de l'un pour l'autre jouait parfois le mauvais
                // extrait (un remix à la place de l'original). resolvePreviewUrl
                // (appelé juste avant l'envoi de chaque manche, cf.
                // startNextRound) résout toujours l'extrait à partir du titre
                // canonique (existing) lui-même, jamais d'une soumission tierce.
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

// mode who_liked (Who Liked It) : le titre est toujours affiché (ce n'est pas
// ce qu'on devine), on privilégie juste les musiques qui ont un extrait sans
// que ce soit bloquant.
//
// Équité : une première passe (triée par couverture, cf. byCoverageDesc)
// réserve un titre par joueur pas encore représenté ; ces manches "d'équité"
// sont ensuite toujours conservées telles quelles. Une seconde passe complète
// les manches restantes avec le reste du pool mélangé, en privilégiant les
// titres avec extrait comme avant — donc plus il y a de manches, plus les
// joueurs ont de chances de voir plusieurs de leurs titres tirés.
const buildWhoLikedRounds = async (pool, requestedRounds, activePlayerIds) => {
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
            ; (result.previewUrl ? withPreview : withoutPreview).push(result.round)
    }

    return [...fairnessRounds, ...withPreview, ...withoutPreview].slice(0, requestedRounds)
}

// nombre de joueurs actifs ayant liké un titre, parmi ceux réellement présents
// dans la partie (le pool peut contenir des likes de joueurs qui ont depuis
// quitté le lobby, cf. buildPool)
const likedByCount = (track, activePlayerIds) =>
    [...track.likedBy].filter((id) => activePlayerIds.includes(id)).length

// un titre est "connu de tous" (cf. modes known_half/known_third) à partir de
// POPULAR_TRACK_THRESHOLD.DEFAULT joueurs actifs qui l'ont liké — un seuil
// plus élevé (BIG_LOBBY) dans un grand lobby, sinon un titre liké par 3
// joueurs sur 12 ne représente plus vraiment "tout le monde" (cf. constants.js)
const isPopularTrack = (track, activePlayerIds) => {
    const threshold =
        activePlayerIds.length >= POPULAR_TRACK_THRESHOLD.BIG_LOBBY_MIN_PLAYERS
            ? POPULAR_TRACK_THRESHOLD.BIG_LOBBY
            : POPULAR_TRACK_THRESHOLD.DEFAULT
    return likedByCount(track, activePlayerIds) > threshold
}

// pioche jusqu'à `count` manches dans `candidates` (déjà mélangés/triés),
// extrait audio requis (repli vers le titre suivant sinon) ; `used` est
// partagé entre tous les appels d'une même partie pour ne jamais reproposer
// un titre déjà retenu pour une autre manche
const takeRounds = async (candidates, count, used) => {
    const rounds = []
    for (const track of candidates) {
        if (rounds.length >= count) break
        if (used.has(track.id)) continue

        const previewUrl = await resolvePreviewUrl(track)
        if (!previewUrl) continue

        used.add(track.id)
        rounds.push({ track: { ...track, previewUrl } })
    }
    return rounds
}

// intervalle "1 titre connu de tous sur N" selon l'algorithme choisi par
// l'hôte (cf. LobbySettingsModal côté client) — absent pour "random"
const POPULAR_SLOT_INTERVAL = { known_half: 2, known_third: 3 }

// mode blindtest : on devine le titre, donc un extrait est indispensable. Le
// choix des titres dépend de trackAlgorithm :
// - random : tirage complètement aléatoire dans le pool, sans autre contrainte
// - known_half / known_third : un titre sur 2 (ou sur 3) doit être "connu de
//   tous" (cf. isPopularTrack) ; si le pool ne contient pas assez de titres
//   populaires distincts pour remplir tous ces créneaux, on comble avec un
//   titre normal à la place — pas d'autre choix possible
const buildBlindtestRounds = async (pool, requestedRounds, activePlayerIds, trackAlgorithm) => {
    const shuffledPool = shuffle(pool)
    const used = new Set()

    const interval = POPULAR_SLOT_INTERVAL[trackAlgorithm]
    if (!interval) {
        return takeRounds(shuffledPool, requestedRounds, used)
    }

    const popularIds = new Set(
        shuffledPool.filter((track) => isPopularTrack(track, activePlayerIds)).map((track) => track.id)
    )
    const popularCandidates = shuffledPool.filter((track) => popularIds.has(track.id))
    const normalCandidates = shuffledPool.filter((track) => !popularIds.has(track.id))

    const rounds = []
    for (let i = 0; i < requestedRounds; i += 1) {
        const wantsPopular = (i + 1) % interval === 0
        const primary = wantsPopular ? popularCandidates : normalCandidates
        const fallback = wantsPopular ? normalCandidates : popularCandidates

        const [picked] = await takeRounds(primary, 1, used)
        if (picked) {
            rounds.push(picked)
            continue
        }
        const [fallbackPicked] = await takeRounds(fallback, 1, used)
        if (fallbackPicked) rounds.push(fallbackPicked)
        // sinon : plus aucun titre disponible avec extrait, cette manche est
        // simplement absente (cf. MIN_ROUNDS_PLAYABLE côté appelant)
    }

    return rounds
}

// nombre d'enrichissements Deezer (cf. resolveDeezerArtist) menés en
// parallèle : assez pour rester rapide, assez peu pour ne pas dépasser la
// limite de requêtes de l'API publique Deezer (non documentée précisément,
// mais de l'ordre de 50 requêtes / 5s par IP)
const DEEZER_ARTIST_BATCH_SIZE = 8

// catalogue de recherche du blindtest : tous les titres likés par le lobby,
// envoyé une seule fois (le joueur cherche dedans plutôt que de choisir parmi
// des options imposées). L'artiste de chaque titre Deezer est enrichi avec
// les featurings (cf. resolveDeezerArtist) pour que "je cherche Pharrell
// Williams" retrouve un titre de Tyler, The Creator feat. Pharrell Williams —
// par lots plutôt que tout en parallèle d'un coup, pour ménager l'API Deezer.
const buildCatalog = async (pool) => {
    const entries = []
    for (let i = 0; i < pool.length; i += DEEZER_ARTIST_BATCH_SIZE) {
        const batch = pool.slice(i, i + DEEZER_ARTIST_BATCH_SIZE)
        const artists = await Promise.all(batch.map((t) => resolveDeezerArtist(t)))
        batch.forEach((t, index) => {
            entries.push({ id: t.id, name: t.name, artist: artists[index], image: t.image ?? null })
        })
    }
    return entries
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
    game.manualAdvance = Boolean(lobby.manualAdvance)
    game.hostId = hostId

    const pool = buildPool(game)
    if (pool.length === 0) {
        throw new GameError("Aucun titre liké n'a été reçu, impossible de lancer la partie")
    }

    const questionType = QUESTION_TYPES[game.gameMode]
    const built =
        questionType === 'who_liked'
            ? await buildWhoLikedRounds(pool, lobby.rounds, activePlayerIds)
            : await buildBlindtestRounds(pool, lobby.rounds, activePlayerIds, lobby.trackAlgorithm)

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
        duration: game.phaseSpeed,
        startedAt: null,
        answers: new Map(),
    }))
    game.currentRoundIndex = -1

    const catalog = questionType === 'guess_track' ? await buildCatalog(pool) : undefined

    io.to(room(code)).emit('game:started', {
        totalRounds: game.rounds.length,
        gameMode: game.gameMode,
        manualAdvance: game.manualAdvance,
        catalog,
    })

    await startNextRound(code, io)
}

const startNextRound = async (code, io) => {
    const game = games.get(code)
    if (!game) return

    game.currentRoundIndex += 1
    const round = game.rounds[game.currentRoundIndex]

    if (!round) {
        finishGame(code, io)
        return
    }

    game.status = 'in_round'
    round.answers = new Map()

    // ré-résout l'extrait juste avant l'envoi plutôt que de faire confiance à
    // celui calculé au lancement de la partie : les extraits Deezer expirent
    // environ 15 minutes après leur émission (cf. preview.service.js /
    // deezer.service.js), et une manche tardive (parties longues, vitesse
    // lente, beaucoup de manches) pouvait donc recevoir un lien déjà mort —
    // "le son ne se met juste pas". Ne remplace que si une résolution fraîche
    // aboutit : sinon on garde l'ancienne valeur plutôt que de perdre l'audio.
    const freshPreviewUrl = await resolvePreviewUrl(round.track)
    if (freshPreviewUrl) round.track.previewUrl = freshPreviewUrl

    // fixé ici (juste avant la diffusion, pas avant la résolution d'extrait
    // ci-dessus qui peut prendre du temps) + AUDIO_SYNC_LEAD_MS de marge :
    // chaque appareil reçoit ce timestamp et programme le lancement de
    // l'extrait pile à cet instant plutôt que dès que son propre buffer est
    // prêt (cf. AudioPlayer.tsx), pour que tout le monde entende la musique
    // démarrer en même temps.
    round.startedAt = audioSyncedStart()

    io.to(room(code)).emit('game:round:start', publicRound(game, round))

    clearTimeout(game.timer)
    game.timer = setTimeout(() => endRound(code, io), AUDIO_SYNC_LEAD_MS + round.duration * 1000)
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

    // ne termine plus la manche dès que tout le monde a répondu : on laisse le
    // timer de round.duration (cf. startNextRound) s'écouler, pour que les
    // joueurs rapides voient le temps restant plutôt que d'être basculés
    // instantanément sur les résultats. On raccourcit quand même l'attente à
    // ROUND_ANSWER_GRACE_MS une fois que tout le monde a répondu, sauf si le
    // chrono naturel devait de toute façon se terminer avant ce délai.
    const allAnswered = game.activePlayerIds.every((id) => round.answers.has(id))
    if (allAnswered) {
        const naturalEndAt = round.startedAt + round.duration * 1000
        const remainingMs = naturalEndAt - Date.now()
        if (remainingMs > ROUND_ANSWER_GRACE_MS) {
            clearTimeout(game.timer)
            game.timer = setTimeout(() => endRound(code, io), ROUND_ANSWER_GRACE_MS)
        }
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
        // détaillés séparément (plutôt qu'un bonusPoints unique) pour que le
        // client puisse expliquer au joueur d'où viennent ses points bonus :
        // série de manches parfaites d'affilée vs. bonus "manche parfaite" fixe
        let streakBonus = 0
        let perfectBonus = 0

        if (isPerfect) {
            score.streak += 1
            score.bestStreak = Math.max(score.bestStreak, score.streak)
            score.perfectRounds += 1
            const streakLevel = Math.max(0, score.streak - 1)
            streakBonus = Math.min(SCORING.STREAK_BONUS_CAP, streakLevel * SCORING.STREAK_BONUS_PER_LEVEL)
            perfectBonus = SCORING.PERFECT_BONUS
        } else {
            score.streak = 0
        }

        const bonusPoints = streakBonus + perfectBonus
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
            speedFactor,
            basePoints,
            streakBonus,
            perfectBonus,
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
        audioStartedAt: audioSyncedStart(),
    })

    // en mode "avancer manuellement" (cf. game.manualAdvance), pas de timer
    // automatique ici : la manche reste affichée tant que l'hôte n'a pas
    // explicitement déclenché la suivante (cf. advanceRound ci-dessous)
    if (!game.manualAdvance) {
        game.timer = setTimeout(() => {
            startNextRound(code, io).catch((err) => {
                console.error('❌ Erreur au démarrage de la manche suivante :', err)
            })
        }, ROUND_RESULTS_PAUSE_MS)
    }
}

// déclenché par l'hôte quand game.manualAdvance est actif : endRound n'a alors
// armé aucun timer automatique, donc rien ne fait avancer la partie sans cet
// appel explicite
export const advanceRound = ({ code, playerId, io }) => {
    const game = games.get(code)
    if (!game || game.status !== 'round_result') return
    if (!game.manualAdvance) return
    if (game.hostId !== playerId) {
        throw new GameError("Seul l'hôte peut passer à la manche suivante", 403)
    }

    clearTimeout(game.timer)
    game.timer = null
    startNextRound(code, io).catch((err) => {
        console.error('❌ Erreur au démarrage de la manche suivante (manuel) :', err)
    })
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

    io.to(room(code)).emit('game:end', { leaderboard, totalRounds, audioStartedAt: audioSyncedStart() })

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
    game.activePlayerIds = game.activePlayerIds.filter((id) => !inactiveIds.includes(id))

    // un seul retrait atomique pour tout le monde (cf. removePlayers) : soit
    // tous les joueurs inactifs sont retirés, soit aucun — plus de risque
    // qu'il en reste un coincé si un retrait individuel échouait en cours de
    // boucle
    try {
        const result = await lobbyService.removePlayers(code, inactiveIds)
        if (result.removed && result.closed) {
            cleanupGame(code)
            io.to(room(code)).emit('lobby:closed')
        } else if (result.removed) {
            io.to(room(code)).emit('lobby:update', result.lobby)
        }
    } catch (err) {
        console.error(`❌ Échec du retrait pour inactivité (lobby ${code}) :`, err)
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
