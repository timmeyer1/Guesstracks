import {
    QUESTION_TYPES,
    SCORING,
    ROUND_RESULTS_PAUSE_MS,
    ROUND_ANSWER_GRACE_MS,
    MIN_ROUNDS_PLAYABLE,
    LOBBY_LIMITS,
    RETURN_TO_LOBBY_TIMEOUT_MS,
    AUDIO_SYNC_LEAD_MS,
    FAIRNESS_MAX_SHARE_FACTOR,
} from '../constants.js'
import { resolvePreviewUrl, normalizeTrackText } from './preview.service.js'
import { resolveDeezerArtist } from './deezer.service.js'
import { flagMatch } from './previewMatch.service.js'
import * as lobbyService from './lobby.service.js'

export class GameError extends Error {
    constructor(message, status = 400) {
        super(message)
        this.status = status
    }
}

// état de la partie en mémoire, par code de lobby. contrairement au lobby (où
// l'API REST fait foi), une partie tourne en temps réel avec des timers
// serveur, dcp c'est le socket qui fait foi ici. en gros c'est un état
// jetable, pas grave s'il disparaît au redémarrage du serveur.
const games = new Map()

// limites anti-abus sur tout ce qui vient du client dans submitTracks : un
// payload trafiqué peut envoyer une chaîne énorme. sans limite, ça se stocke
// en mémoire et se rediffuse à tout le lobby, facile de planter le serveur
// avec ça (DoS).
const MAX_NAME_LENGTH = 60 // même limite que playerSchema.name dans lobby.model.js
const MAX_FIELD_LENGTH = 300 // large marge, aucun vrai titre/artiste/album ne fait cette taille
const MAX_URL_LENGTH = 2000 // pour image/previewUrl, large assez pour une vraie URL de CDN

const room = (code) => `lobby:${code}`

// heure commune à laquelle tout le monde doit lancer la lecture d'un extrait,
// avec la même marge que pour une manche (voir AUDIO_SYNC_LEAD_MS). utilisé
// quand on rejoue un extrait sur les écrans de résultats.
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
            // si true, endRound n'enclenche pas de timer auto, l'hôte doit
            // cliquer lui-même pour passer à la manche suivante
            manualAdvance: false,
            hostId: null,
            // id de titre -> previewUrl (ou null). rempli dès que les joueurs
            // envoient leurs musiques, pas juste au lancement. ça survit si
            // on rejoue dans le même lobby, donc jamais remis à zéro ici.
            previewCache: new Map(),
            // pour pas lancer plusieurs pré-chauffages en même temps (un par
            // joueur qui envoie ses musiques)
            previewWarming: false,
            // passe à true dès que startGame valide le lancement et commence
            // à résoudre les extraits lui-même. ça arrête le pré-chauffage en
            // même temps, sinon les deux tapent Deezer/iTunes en parallèle.
            // repasse à false à la fin de la partie.
            launching: false,
            rounds: [],
            currentRoundIndex: -1,
            timer: null,
            // ids des joueurs qu'on attend encore au lobby après la fin d'une
            // partie, avant de pouvoir relancer. vide en dehors de cette
            // fenêtre d'attente.
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
    // si la partie est déjà lancée, un envoi tardif est ignoré, le pool est déjà
    // figé. mais 'finished' compte comme 'collecting' : entre deux parties, un
    // joueur (nouveau ou qui renvoie ses musiques) doit pouvoir s'enregistrer,
    // sinon ça reste bloqué sur "en attente des musiques d'un joueur". on
    // rediffuse l'état quand même, pour ceux qui reviennent après un kick.
    if (game.status !== 'collecting' && game.status !== 'finished') {
        io?.to(room(code)).emit('game:tracksProgress', {
            submittedPlayerIds: [...game.submittedTracks.keys()],
        })
        return { accepted: false }
    }

    // name/img viennent direct du payload, pas du jeton vérifié (pas sensible
    // pour l'identité, mais on valide/limite quand même) : sinon un client
    // pourrait envoyer un truc énorme ou pas une string, stocké puis rediffusé
    // à tout le lobby.
    game.playersInfo.set(player.id, {
        id: player.id,
        name: typeof player.name === 'string' && player.name.trim() ? player.name.trim().slice(0, MAX_NAME_LENGTH) : 'Joueur',
        img: typeof player.img === 'string' ? player.img.slice(0, MAX_URL_LENGTH) : null,
    })

    const sanitized = Array.isArray(tracks)
        ? tracks
            .filter((t) => t && typeof t.id === 'string' && typeof t.name === 'string' && typeof t.artist === 'string')
            // garde-fou anti-abus, pas une vraie limite : c'est large au-dessus
            // de ce qu'une bibliothèque likée peut atteindre, pour jamais
            // couper un vrai joueur.
            .slice(0, 5000)
            .map((t) => ({
                id: t.id.slice(0, MAX_FIELD_LENGTH),
                name: t.name.slice(0, MAX_FIELD_LENGTH),
                artist: t.artist.slice(0, MAX_FIELD_LENGTH),
                album: typeof t.album === 'string' ? t.album.slice(0, MAX_FIELD_LENGTH) : '',
                image: typeof t.image === 'string' ? t.image.slice(0, MAX_URL_LENGTH) : null,
                previewUrl: typeof t.previewUrl === 'string' ? t.previewUrl.slice(0, MAX_URL_LENGTH) : null,
                // nécessaire pour resolveDeezerArtist, pour savoir quels titres
                // enrichir avec les artistes en feat. sans ce champ, plus
                // aucun titre n'était enrichi.
                provider: typeof t.provider === 'string' ? t.provider : null,
            }))
        : []

    game.submittedTracks.set(player.id, sanitized)
    if (!game.scores.has(player.id)) game.scores.set(player.id, emptyScore())

    // permet au lobby d'afficher qui a déjà envoyé ses musiques, et de bloquer
    // "Lancer la partie" tant que tout le monde n'a pas envoyé. sinon un
    // lancement trop rapide démarrait avec un pool incomplet, la cause la plus
    // probable des manches où un seul joueur apparaissait comme bonne réponse.
    io?.to(room(code)).emit('game:tracksProgress', {
        submittedPlayerIds: [...game.submittedTracks.keys()],
    })

    // pré-charge les extraits en fond dès cet envoi, pas au clic sur "Lancer" :
    // le but, que le lancement soit instantané si tout le monde a soumis
    // depuis un moment.
    warmPreviewCache(code, game).catch((err) => {
        console.error('❌ Erreur lors du pré-chauffage des extraits :', err)
    })

    return { accepted: true }
}

// un même morceau peut avoir plusieurs id chez le même fournisseur (single vs
// édition album, remaster...). ex vu chez Deezer : "Fever" de Dua Lipa a un id
// pour le single et un autre pour l'édition album. en regroupant par id, ces
// doublons se retrouvaient deux fois dans le catalogue du blindtest. dcp on
// regroupe plutôt par nom+artiste normalisé.
const poolKey = (track) => `${normalizeTrackText(track.name)}::${normalizeTrackText(track.artist)}`

const buildPool = (game) => {
    const merged = new Map() // clé "nom::artiste" normalisée -> track + Set<playerId>

    for (const [playerId, tracks] of game.submittedTracks) {
        for (const track of tracks) {
            const key = poolKey(track)
            const existing = merged.get(key)
            if (existing) {
                existing.likedBy.add(playerId)
                // on ne pioche plus le previewUrl d'une autre soumission ici :
                // deux titres dédupliqués sur le même nom+artiste peuvent être
                // des éditions différentes (single vs album, remix...), et ça
                // jouait parfois le mauvais extrait. resolvePreviewUrl (juste
                // avant chaque manche) résout toujours l'extrait à partir du
                // titre canonique lui-même.
            } else {
                merged.set(key, { ...track, likedBy: new Set([playerId]) })
            }
        }
    }

    return [...merged.values()]
}

// nombre de résolutions d'extrait en parallèle pendant le pré-chargement.
// contrairement à DEEZER_ARTIST_BATCH_SIZE, résoudre un extrait non-Deezer
// peut déclencher plusieurs requêtes par titre, donc on reste prudent sur le
// nombre de titres par lot. baissé de 16 à 8 puis à 4 après des cas réels où
// des gros lots ont fait chuter le taux de succès (rate limiting Deezer/iTunes).
const PREVIEW_PREFETCH_BATCH_SIZE = 4
// marge de sécurité (succès visés au-delà de requestedRounds) avant d'arrêter
// le pré-chargement : la répartition par joueur peut écarter des titres qui
// ONT un extrait, donc on en prévoit un peu plus.
const PREVIEW_PREFETCH_SUCCESS_MARGIN = 1.2
// plafond de sécurité si le taux de succès est mauvais, sinon on préchargerait tout le pool.
const PREVIEW_PREFETCH_MAX_FACTOR = 3

// pré-résout les extraits par lots EN PARALLÈLE plutôt qu'un par un pendant la
// construction des manches, sinon le temps de lancement grandissait avec le
// nombre de manches. s'arrête dès qu'on a assez de titres AVEC extrait (voir
// PREVIEW_PREFETCH_SUCCESS_MARGIN). utilise le cache déjà chauffé par
// warmPreviewCache, donc souvent ça ne fait plus aucun vrai appel réseau.
const prefetchPreviews = async (game, orderedPool, requestedRounds) => {
    const cache = game.previewCache
    const code = game.code
    const maxSize = Math.min(orderedPool.length, requestedRounds * PREVIEW_PREFETCH_MAX_FACTOR)
    const successTarget = Math.ceil(requestedRounds * PREVIEW_PREFETCH_SUCCESS_MARGIN)
    let successCount = 0
    let tried = 0

    for (let i = 0; i < maxSize && successCount < successTarget; i += PREVIEW_PREFETCH_BATCH_SIZE) {
        const batch = orderedPool.slice(i, i + PREVIEW_PREFETCH_BATCH_SIZE)
        tried += batch.length
        const toFetch = batch.filter((t) => !cache.has(t.id))

        if (toFetch.length > 0) {
            const previews = await Promise.all(toFetch.map((t) => resolvePreviewUrl(t)))
            // on garde en cache que les succès : un échec ici vient souvent
            // du rate limiting du lot en cours, pas d'une vraie absence
            // d'extrait. le laisser hors cache permet de le retrouver plus
            // tard (lot suivant, chauffage, ré-résolution avant la manche).
            toFetch.forEach((t, index) => {
                if (previews[index]) cache.set(t.id, previews[index])
            })
        }
        successCount += batch.filter((t) => cache.get(t.id)).length
    }
    // utile pour diagnostiquer plus tard (rate limiting, pool trop petit...),
    // sans le détail par lot qui serait trop verbeux.
    console.log(
        `⏱️ [${code}] prefetchPreviews : ${successCount}/${tried} extraits trouvés (cible ${successTarget}, plafond ${maxSize})`
    )
    return cache
}

const resolvePreviewCached = async (track, previewCache) => {
    if (previewCache.has(track.id)) return previewCache.get(track.id)
    const previewUrl = await resolvePreviewUrl(track)
    // on garde que les succès en cache, même logique que dans
    // preview.service.js. un échec vient souvent d'une rafale de résolutions
    // en parallèle, pas d'une vraie absence d'extrait. pas de cache = une
    // chance de le retrouver plus tard plutôt que de le condamner pour le
    // reste de la partie.
    if (previewUrl) previewCache.set(track.id, previewUrl)
    return previewUrl
}

// chauffage de fond : lots plus petits qu'au lancement (pas d'urgence ici) +
// pause entre chaque lot, pour pas bouffer tout le débit externe pendant que
// les joueurs patientent. un lobby peut rester ouvert plusieurs minutes.
const PREVIEW_WARM_BATCH_SIZE = 5
const PREVIEW_WARM_BATCH_DELAY_MS = 200
// plafond : pas la peine de chauffer des milliers de titres quand une partie
// n'en garde jamais qu'un petit multiple du nombre de manches. même logique
// que prefetchPreviews, mais basé sur MAX_ROUNDS car le nombre réel de
// manches n'est pas encore fixé pendant l'attente au lobby.
const PREVIEW_WARM_MAX_TRACKS = LOBBY_LIMITS.MAX_ROUNDS * PREVIEW_PREFETCH_MAX_FACTOR

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

// pré-charge un bout du pool en fond PENDANT l'attente au lobby (à chaque
// envoi de musiques), pas au clic sur "Lancer". s'arrête dès que
// game.launching passe à true, sinon deux boucles tapent Deezer/iTunes en
// même temps et ça déclenche du rate limiting. une seule passe à la fois par
// partie, le pool est recalculé à chaque lot si un nouveau joueur a soumis.
const warmPreviewCache = async (code, game) => {
    if (game.previewWarming || game.launching) return
    game.previewWarming = true
    try {
        let i = 0
        // on reconstruit le pool seulement si le nombre de joueurs ayant
        // soumis a changé, pour pas refaire le merge à chaque lot sur un
        // gros pool.
        let pool = buildPool(game)
        let trackedSubmissionCount = game.submittedTracks.size
        while (games.get(code) === game && !game.launching) {
            if (game.submittedTracks.size !== trackedSubmissionCount) {
                // cet ordre n'est pas mélangé, le vrai tirage au lancement
                // reste aléatoire. sur un gros pool, ce chauffage ne couvre
                // donc qu'une partie de ce qu'il faudra, mais on préfère
                // garder de la variété plutôt qu'un alignement parfait.
                pool = buildPool(game)
                trackedSubmissionCount = game.submittedTracks.size
            }
            if (i >= pool.length || i >= PREVIEW_WARM_MAX_TRACKS) break

            const batch = pool.slice(i, i + PREVIEW_WARM_BATCH_SIZE).filter((t) => !game.previewCache.has(t.id))
            i += PREVIEW_WARM_BATCH_SIZE
            if (batch.length === 0) continue

            const previews = await Promise.all(batch.map((t) => resolvePreviewUrl(t)))
            // on garde que les succès en cache, un titre sans extrait ici
            // pourra retenter au passage suivant plutôt que d'être condamné
            // direct.
            batch.forEach((t, index) => {
                if (previews[index]) game.previewCache.set(t.id, previews[index])
            })
            await sleep(PREVIEW_WARM_BATCH_DELAY_MS)
        }
    } finally {
        game.previewWarming = false
    }
}

// renvoie le seul joueur qui a liké ce titre, ou null si liké par plusieurs
// (titre "partagé"). utilisé pour isoler la bibliothèque de chaque joueur,
// casser les séries trop longues, et pour les logs de diagnostic.
const exclusiveOwner = (track, activePlayerIds) => {
    const likers = [...track.likedBy].filter((id) => activePlayerIds.includes(id))
    return likers.length === 1 ? likers[0] : null
}

// nombre max de manches d'affilée pour le même joueur, tous modes confondus.
// au-delà on force un changement, même si le plafond global (~60% à
// 2 joueurs) est encore loin d'être atteint. sans ça on avait des séries de
// 8-10 manches d'affilée, toujours dans le même ordre, trop prévisible.
const MAX_OWNER_STREAK = 5

// réordonne les manches (déjà décidées par l'appelant) pour qu'aucun joueur
// n'enchaîne plus de MAX_OWNER_STREAK manches d'affilée, en restant sinon
// aléatoire. une manche partagée (sans propriétaire unique) coupe toujours
// la série en cours. glouton : à chaque position on prend le premier item
// restant qui prolonge pas une série déjà pleine, sinon on prend le premier
// quand même.
const sequenceWithMaxStreak = (items, maxStreak, ownerOf) => {
    const remaining = shuffle(items)
    const result = []
    let streakOwner = null
    let streakLen = 0

    while (remaining.length > 0) {
        const index = remaining.findIndex((item) => {
            const owner = ownerOf(item)
            return !(owner && owner === streakOwner && streakLen >= maxStreak)
        })
        const [picked] = remaining.splice(index === -1 ? 0 : index, 1)
        const owner = ownerOf(picked)
        streakLen = owner && owner === streakOwner ? streakLen + 1 : owner ? 1 : 0
        streakOwner = owner
        result.push(picked)
    }
    return result
}

// décide À L'AVANCE combien de manches chaque joueur doit fournir avec ses
// propres titres, plutôt que de piocher au hasard dans un pool fusionné et
// d'espérer une bonne répartition. avant, un compte à grosse bibliothèque
// était statistiquement tiré plus souvent, le plafond l'empêchait juste de
// dépasser 60% sans jamais vraiment équilibrer. ici la répartition est
// décidée d'abord (dans les bornes du plafond).
const allocateRoundsPerPlayer = (requestedRounds, activePlayerIds, requireCoverage) => {
    const n = activePlayerIds.length
    const fairShare = requestedRounds / n
    let minShare = Math.floor(fairShare / FAIRNESS_MAX_SHARE_FACTOR)
    // en who_liked chaque joueur doit apparaître au moins une fois. sans
    // objet en blindtest, on montre jamais qui a liké le titre.
    if (requireCoverage) minShare = Math.max(minShare, 1)
    // filet de sécurité : s'il y a plus de joueurs que de manches demandées,
    // la couverture minimale est impossible pour tout le monde. on répartit
    // alors ce qu'il y a plutôt que de dépasser le nombre de manches.
    if (minShare * n > requestedRounds) minShare = Math.floor(requestedRounds / n)
    const maxShare = Math.max(minShare, Math.ceil(fairShare * FAIRNESS_MAX_SHARE_FACTOR))

    const allocation = new Map(activePlayerIds.map((id) => [id, minShare]))
    let remaining = requestedRounds - minShare * n

    // distribue le reste un par un, au hasard parmi les joueurs pas encore à
    // leur plafond, pour pas que ce soit toujours le même qui récupère le
    // "reste".
    while (remaining > 0) {
        const eligible = activePlayerIds.filter((id) => allocation.get(id) < maxShare)
        const candidates = eligible.length > 0 ? eligible : activePlayerIds
        const pick = candidates[Math.floor(Math.random() * candidates.length)]
        allocation.set(pick, allocation.get(pick) + 1)
        remaining -= 1
    }
    return allocation
}

// cœur commun aux deux modes : chaque joueur pioche dans SA bibliothèque
// exclusive le nombre de manches qui lui a été attribué. si elle ne suffit
// pas (peu de titres, ou pas assez avec extrait en blindtest), on comble avec
// n'importe quel titre du pool plutôt que de laisser des manches vides (voir
// MIN_ROUNDS_PLAYABLE si même ça suffit pas).
// part de manches réservée à des titres likés par plusieurs joueurs (pas
// juste un seul) : une fraction aléatoire du total, tirée à chaque partie.
// sans ça, un titre partagé n'apparaissait quasiment jamais, seulement en
// dernier recours.
const SHARED_ROUNDS_MIN_RATIO = 0.1
const SHARED_ROUNDS_MAX_RATIO = 0.3

const buildRoundsForPlayers = async (game, pool, requestedRounds, activePlayerIds, requireCoverage, requirePreview) => {
    const code = game.code
    const used = new Set()

    // bibliothèque exclusive de chaque joueur + pool des titres partagés,
    // mélangés une seule fois. le même ordre sert au pré-chauffage (fait un
    // par un, pas en parallèle) et au tirage juste après. si on chauffe dans
    // un ordre et qu'on tire dans un autre, le chauffage sert presque à rien,
    // ça nous est déjà arrivé.
    const exclusiveByPlayer = new Map(
        activePlayerIds.map((id) => [id, shuffle(pool.filter((t) => exclusiveOwner(t, activePlayerIds) === id))])
    )
    const sharedPool = shuffle(pool.filter((t) => exclusiveOwner(t, activePlayerIds) === null))

    // taille de préchauffage approximative, pas besoin d'être pile exact,
    // prefetchPreviews a déjà sa propre marge.
    const fairSharePerPlayer = Math.ceil(requestedRounds / activePlayerIds.length)
    for (const id of activePlayerIds) {
        await prefetchPreviews(game, exclusiveByPlayer.get(id), fairSharePerPlayer)
    }
    await prefetchPreviews(game, sharedPool, Math.ceil(requestedRounds * SHARED_ROUNDS_MAX_RATIO))
    const previewCache = game.previewCache

    // essaie les candidats dans l'ordre donné. en blindtest (requirePreview),
    // un titre sans extrait est écarté direct, on passe au suivant. en
    // who_liked, un titre sans extrait est mis de côté en solution de repli :
    // on prend d'abord tout ce qui a un extrait, et on pioche dans le reste
    // seulement si ça suffit pas, pour qu'une manche silencieuse reste rare.
    const takeFrom = async (candidates, count) => {
        const withPreview = []
        const withoutPreview = []
        // on plafonne le nombre de candidats vraiment scannés (même facteur
        // que prefetchPreviews). sinon en who_liked, si personne n'a
        // d'extrait, on scannait toute la bibliothèque (des milliers de
        // résolutions) avant de se rabattre sur le repli, beaucoup trop lent.
        const maxScan = Math.min(candidates.length, count * PREVIEW_PREFETCH_MAX_FACTOR)
        for (let i = 0; i < maxScan; i += 1) {
            if (withPreview.length >= count) break
            const track = candidates[i]
            if (used.has(track.id)) continue
            const likedBy = [...track.likedBy].filter((id) => activePlayerIds.includes(id))
            if (likedBy.length === 0) continue

            const previewUrl = await resolvePreviewCached(track, previewCache)
            if (!previewUrl) {
                if (!requirePreview) withoutPreview.push({ id: track.id, track: { ...track, previewUrl }, likedBy })
                continue
            }
            used.add(track.id)
            withPreview.push({ track: { ...track, previewUrl }, likedBy })
        }
        while (withPreview.length < count && withoutPreview.length > 0) {
            const next = withoutPreview.shift()
            if (used.has(next.id)) continue
            used.add(next.id)
            withPreview.push(next)
        }
        return withPreview
    }

    // on réserve d'abord les manches "titres partagés", avant la répartition
    // par joueur qui elle pioche que dans les bibliothèques exclusives.
    const sharedTarget = Math.round(
        requestedRounds * (SHARED_ROUNDS_MIN_RATIO + Math.random() * (SHARED_ROUNDS_MAX_RATIO - SHARED_ROUNDS_MIN_RATIO))
    )
    const sharedTaken = await takeFrom(sharedPool, sharedTarget)
    console.log(
        `🎯 [${code}] titres partagés : ${sharedTaken.length}/${sharedTarget} visé(es) (${sharedPool.length} dispo, cible ${Math.round(SHARED_ROUNDS_MIN_RATIO * 100)}-${Math.round(SHARED_ROUNDS_MAX_RATIO * 100)}% de ${requestedRounds})`
    )

    // le reste est réparti entre joueurs comme avant, mais sur le nombre de
    // manches qui reste une fois les titres partagés retirés.
    const remainingForPlayers = requestedRounds - sharedTaken.length
    const allocation = allocateRoundsPerPlayer(remainingForPlayers, activePlayerIds, requireCoverage)
    console.log(
        `🎯 [${code}] répartition par joueur (sur ${remainingForPlayers} manches restantes) : ${JSON.stringify([...allocation.entries()])}`
    )

    const rounds = [...sharedTaken]
    let shortfall = 0
    for (const id of activePlayerIds) {
        const exclusive = exclusiveByPlayer.get(id)
        const taken = await takeFrom(exclusive, allocation.get(id))
        rounds.push(...taken)
        const missing = allocation.get(id) - taken.length
        shortfall += missing
        console.log(
            `🎯 [${code}] ${id} : ${taken.length}/${allocation.get(id)} pioché(es) dans sa bibliothèque exclusive (${exclusive.length} titres dispo)${missing > 0 ? ` — ${missing} manquante(s), comblée(s) via le reste du pool` : ''}`
        )
    }
    if (shortfall > 0) {
        rounds.push(...(await takeFrom(shuffle(pool), shortfall)))
    }

    // limite les séries d'affilée (MAX_OWNER_STREAK) : le contenu des manches
    // change pas, seul l'ordre dans lequel elles sont jouées est réordonné.
    const ordered = sequenceWithMaxStreak(rounds, MAX_OWNER_STREAK, (r) => (r.likedBy.length === 1 ? r.likedBy[0] : null))
    console.log(
        `🎯 [${code}] séquence finale (${ordered.length}/${requestedRounds}) : ${ordered
            .map((r) => (r.likedBy.length === 1 ? r.likedBy[0] : 'partagé'))
            .join(', ')}`
    )
    return ordered
}

// mode who_liked : le titre est toujours affiché, un extrait est bien mais
// pas obligatoire. chaque joueur actif doit apparaître au moins une fois
// (couverture minimale).
const buildWhoLikedRounds = (game, pool, requestedRounds, activePlayerIds) =>
    buildRoundsForPlayers(game, pool, requestedRounds, activePlayerIds, true, false)

// mode blindtest : on devine le titre, donc l'extrait est obligatoire. pas
// de couverture minimale, on montre jamais qui a liké le titre.
const buildBlindtestRounds = (game, pool, requestedRounds, activePlayerIds) =>
    buildRoundsForPlayers(game, pool, requestedRounds, activePlayerIds, false, true)

// nombre d'enrichissements Deezer menés en parallèle : assez pour rester
// rapide, assez peu pour pas dépasser la limite de l'API Deezer (~50
// requêtes/5s par IP, pas officiellement documenté).
const DEEZER_ARTIST_BATCH_SIZE = 8

// catalogue de recherche du blindtest : tous les titres likés du lobby,
// envoyé une fois (le joueur cherche dedans). l'artiste vient du client, pas
// encore enrichi des feat, aucun appel réseau ici pour que le lancement soit
// pas plus lent avec un gros pool (voir enrichCatalogInBackground pour l'enrichissement).
const buildCatalog = (pool) => pool.map((t) => ({ id: t.id, name: t.name, artist: t.artist, image: t.image ?? null }))

// enrichit l'artiste de chaque titre Deezer avec les feat (ex: chercher
// "Pharrell Williams" retrouve un titre de Tyler, The Creator feat. lui).
// fait APRÈS le lancement de la partie, jamais attendu par startGame, sinon
// le lancement ralentissait avec le nombre de joueurs (plus de joueurs =
// plus de titres à enrichir).
const enrichCatalogInBackground = async (code, game, pool, io) => {
    for (let i = 0; i < pool.length; i += DEEZER_ARTIST_BATCH_SIZE) {
        // la partie a pu être relancée ou nettoyée entre-temps, dans ce cas
        // on arrête, ce serait obsolète ou pour personne.
        if (games.get(code) !== game) return

        const batch = pool.slice(i, i + DEEZER_ARTIST_BATCH_SIZE)
        const artists = await Promise.all(batch.map((t) => resolveDeezerArtist(t)))
        const updates = batch
            .map((t, index) => ({ id: t.id, artist: artists[index] }))
            .filter((entry, index) => entry.artist !== batch[index].artist)

        if (games.get(code) !== game) return
        if (updates.length > 0) {
            io.to(room(code)).emit('game:catalogEnriched', { updates })
        }
    }
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
    // une partie finie peut être relancée sans quitter le lobby : pas besoin
    // de renvoyer ses musiques, seuls les scores et les manches repartent à
    // zéro.
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
    // relancer trop vite pouvait coincer des joueurs sur l'écran de résultats
    // précédent, désync avec la nouvelle partie. dcp on attend que chacun ait
    // donné signe de vie (revenu au lobby ou parti).
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

    // évite de démarrer avec un pool incomplet (un joueur qui vient de
    // rejoindre et n'a pas encore envoyé ses musiques). sans ce check, ça
    // démarrait silencieusement avec un pool tronqué.
    const missingSubmissions = activePlayerIds.filter((id) => !game.submittedTracks.has(id))
    if (missingSubmissions.length > 0) {
        throw new GameError(
            missingSubmissions.length === 1
                ? "En attente des musiques likées d'un joueur avant de lancer la partie"
                : `En attente des musiques likées de ${missingSubmissions.length} joueurs avant de lancer la partie`
        )
    }

    // à partir d'ici le lancement est acté, donc on stoppe le pré-chauffage
    // de fond avant de faire nos propres appels réseau. sinon les deux tapent
    // Deezer/iTunes en même temps et ça déclenche du rate limiting (déjà vu
    // en prod).
    game.launching = true

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

    // pour du diagnostic : le nombre de manches qu'un joueur peut fournir
    // dépend de son pool exclusif (titres qu'il est seul à avoir likés), pas
    // de son nombre de titres likés total. un joueur dont les goûts recoupent
    // beaucoup ceux des autres peut avoir un pool exclusif tout petit, même
    // avec plein de titres likés.
    const exclusiveCounts = activePlayerIds.map(
        (id) => [id, pool.filter((t) => exclusiveOwner(t, activePlayerIds) === id).length]
    )
    const sharedCount = pool.filter((t) => exclusiveOwner(t, activePlayerIds) === null).length
    console.log(
        `⏱️ [${code}] pool : ${pool.length} titres au total, ${sharedCount} partagés, exclusifs par joueur : ${JSON.stringify(exclusiveCounts)}`
    )

    const questionType = QUESTION_TYPES[game.gameMode]
    const built =
        questionType === 'who_liked'
            ? await buildWhoLikedRounds(game, pool, lobby.rounds, activePlayerIds)
            : await buildBlindtestRounds(game, pool, lobby.rounds, activePlayerIds)

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
        // ids des joueurs qui ont déjà signalé un mauvais extrait sur cette
        // manche, un signalement par joueur et par manche max, pour qu'un
        // clic répété compte pas plusieurs fois.
        wrongPreviewReportedBy: new Set(),
    }))
    game.currentRoundIndex = -1

    const catalog = questionType === 'guess_track' ? buildCatalog(pool) : undefined

    io.to(room(code)).emit('game:started', {
        totalRounds: game.rounds.length,
        gameMode: game.gameMode,
        manualAdvance: game.manualAdvance,
        catalog,
    })

    if (questionType === 'guess_track') {
        enrichCatalogInBackground(code, game, pool, io).catch((err) => {
            console.error('❌ Erreur lors de l\'enrichissement du catalogue :', err)
        })
    }

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

    // on résout l'extrait à nouveau juste avant l'envoi, plutôt que de faire
    // confiance à celui calculé au lancement : les extraits Deezer expirent
    // en gros après 15 min, et une manche tardive pouvait recevoir un lien
    // mort ("le son se lance pas"). on remplace que si la nouvelle résolution
    // marche, sinon on garde l'ancienne plutôt que de perdre le son.
    const freshPreviewUrl = await resolvePreviewUrl(round.track)
    if (freshPreviewUrl) round.track.previewUrl = freshPreviewUrl

    // fixé juste avant l'envoi (pas avant la résolution d'extrait au-dessus,
    // qui peut prendre du temps) + une marge de AUDIO_SYNC_LEAD_MS. chaque
    // appareil programme le lancement pile à cet instant plutôt que dès que
    // son buffer est prêt, pour que tout le monde entende la musique en même
    // temps.
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

    // on termine plus la manche direct quand tout le monde a répondu, on
    // laisse le chrono normal continuer pour que les rapides voient le temps
    // restant. on raccourcit juste à ROUND_ANSWER_GRACE_MS une fois que tout
    // le monde a répondu, sauf si le chrono naturel finissait plus tôt.
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
        // cocher une seule mauvaise personne annule tous les points de la
        // manche, même si le reste était juste
        const hasWrongPick = incorrectSelected > 0
        const recall = correctSet.size > 0 ? correctSelected / correctSet.size : 0
        const earnedPoints = !hasWrongPick && recall > 0
        const isPerfect = !hasWrongPick && recall === 1 && selectedIds.length > 0

        const speedFactor = Math.max(SCORING.MIN_SPEED_FACTOR, 1 - elapsedMs / (round.duration * 1000))

        // plus on trouve de bonnes réponses (sans erreur), plus le score
        // s'approche du max : trouver une seule bonne personne sur plusieurs
        // rapporte qu'une fraction des points
        const basePoints = earnedPoints ? Math.round(SCORING.BASE_POINTS * recall * speedFactor) : 0
        // détaillés séparément (pas un seul bonusPoints) pour que le client
        // puisse expliquer d'où viennent les points bonus : série ou bonus
        // manche parfaite
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

// déclenché par le bouton "Pas le bon extrait ?" de l'écran de résultat (cf.
// RoundResult.tsx) : ne fait jamais confiance à un titre/artiste envoyé par
// le client (falsifiable), seulement au round CONNU du serveur pour ce code
// de partie — même garde que submitAnswer/advanceRound (round courant,
// joueur actif de cette partie). N'affecte que la base globale de
// correspondances vérifiées (cf. previewMatch.service.js) : sans effet
// immédiat sur la manche déjà jouée, seulement sur les résolutions futures
// (cette partie ou une autre) du même titre+artiste.
export const reportWrongPreview = ({ code, playerId, roundIndex }) => {
    const game = games.get(code)
    if (!game || game.status !== 'round_result') return

    const round = game.rounds[game.currentRoundIndex]
    if (!round || round.index !== roundIndex) return
    if (!game.activePlayerIds.includes(playerId)) return
    // un signalement par joueur et par manche (cf. la déclaration de
    // wrongPreviewReportedBy, plus haut dans startGame) : évite qu'un clic
    // répété ne compte plusieurs fois dans le seuil global d'invalidation
    if (round.wrongPreviewReportedBy.has(playerId)) return
    round.wrongPreviewReportedBy.add(playerId)

    flagMatch(round.track.name, round.track.artist)
        .then((invalidated) => {
            if (invalidated) {
                console.log(
                    `🚩 [${code}] extrait invalidé après signalements répétés : "${round.track.name}" — ${round.track.artist}`
                )
            }
        })
        .catch(() => {})
    // pas de diffusion à toute la room : un signalement est individuel, les
    // autres joueurs n'ont pas besoin de le savoir
}

const finishGame = (code, io) => {
    const game = games.get(code)
    if (!game) return
    clearTimeout(game.timer)
    game.timer = null
    game.status = 'finished'
    // rouvre la fenêtre de pré-chauffage pour l'attente avant un éventuel
    // "rejouer" (cf. game.launching, startGame) : plus rien ne le
    // redéclenchera tant qu'un joueur ne renvoie pas ses musiques (cf.
    // submitTracks), mais au moins ça ne reste pas bloqué à true pour rien
    game.launching = false

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
