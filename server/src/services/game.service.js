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
            // id de titre -> previewUrl | null, alimenté dès la soumission des
            // musiques (cf. warmPreviewCache), pas seulement au lancement —
            // survit à une partie relancée dans le même lobby (rejouer), donc
            // ne se réinitialise jamais explicitement ici
            previewCache: new Map(),
            // évite d'empiler plusieurs passes de pré-chauffage concurrentes
            // (une par joueur qui soumet ses musiques), cf. warmPreviewCache
            previewWarming: false,
            // true dès que startGame a validé le lancement et commence à
            // résoudre les extraits lui-même : stoppe warmPreviewCache pour
            // que les deux ne tapent plus Deezer/iTunes en même temps (cf.
            // warmPreviewCache) — remis à false une fois la partie terminée
            launching: false,
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

    // pré-chauffe les extraits en tâche de fond dès cet envoi plutôt que
    // d'attendre le clic sur "Lancer" (cf. warmPreviewCache) : objectif, que
    // le lancement ne fasse plus aucun aller-retour réseau une fois que tout
    // le monde a soumis depuis un moment
    warmPreviewCache(code, game).catch((err) => {
        console.error('❌ Erreur lors du pré-chauffage des extraits :', err)
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

// nombre de résolutions d'extrait (cf. resolvePreviewUrl) menées en parallèle
// lors du pré-chargement ci-dessous. Contrairement à DEEZER_ARTIST_BATCH_SIZE
// (un seul GET /track/{id} par titre), une résolution d'extrait pour un titre
// non-Deezer déclenche plusieurs requêtes de recherche en parallèle (cf.
// searchDeezerPreview/searchItunesPreview, preview.service.js) — la valeur
// ci-dessous vise donc un nombre de TITRES par lot plus prudent, à ajuster
// selon le taux de succès observé en conditions réelles (cf. le log
// "prefetchPreviews" plus bas) : si le taux chute quand on l'augmente, c'est
// le signe qu'on cogne une limite de débit externe, pas un gain de vitesse.
// Abaissé de 16 à 8 après un cas réel (pool de 3339 titres) où des lots de 16
// — chacun capable de déclencher jusqu'à ~4 requêtes par titre non-Deezer,
// donc potentiellement 64 requêtes HTTP simultanées — ont fait chuter le taux
// de succès à quasi zéro sur plusieurs lots d'affilée, signe net de rate
// limiting Deezer/iTunes plutôt que d'un manque d'extraits disponibles.
const PREVIEW_PREFETCH_BATCH_SIZE = 8
// marge de sécurité (nombre de succès visés au-delà de requestedRounds) avant
// d'arrêter le pré-chargement : l'équité (cf. byFairness) ou les manches
// "who_liked" sans recouvrement peuvent écarter des candidats qui ONT un
// extrait, il en faut donc un peu plus que le strict nécessaire en réserve
const PREVIEW_PREFETCH_SUCCESS_MARGIN = 1.2
// plafond absolu (filet de sécurité si le taux de succès est mauvais) : sans
// lui, un pool où peu de titres ont un extrait ferait pré-charger tout le pool
const PREVIEW_PREFETCH_MAX_FACTOR = 3

// pré-résout les extraits par lots EN PARALLÈLE pour un préfixe du pool
// mélangé, plutôt qu'un par un au fil de la construction des manches
// ci-dessous : avant ce cache, chaque manche attendait son propre
// aller-retour réseau l'une après l'autre, donc le temps de lancement
// grandissait linéairement avec le nombre de manches demandées (perceptible
// dès qu'une partie en comptait beaucoup, même à 2 joueurs). S'arrête dès
// qu'assez de candidats AVEC extrait ont été trouvés (cf.
// PREVIEW_PREFETCH_SUCCESS_MARGIN) plutôt que de systématiquement interroger
// un préfixe de taille fixe : sur un pool où la plupart des titres ont un
// extrait (cas courant), ça évite de continuer à appeler les API externes une
// fois la marge déjà couverte. `orderedPool` détermine l'ordre de
// préchargement (le mélange déjà utilisé pour construire les manches) ; un
// titre hors de ce qui a été pré-chargé (candidat au-delà de l'arrêt anticipé,
// ou pool réduit avec beaucoup d'échecs) retombe simplement sur une
// résolution à la demande, cf. resolvePreviewCached.
// Utilise `game.previewCache`, déjà en grande partie chauffé par
// warmPreviewCache pendant l'attente au lobby (cf. plus bas) : ne fait donc
// un VRAI aller-retour réseau que pour ce qui manque encore au cache — dans
// le cas courant (tout le monde a soumis ses musiques depuis un moment avant
// que l'hôte clique sur "Lancer"), cette boucle ne fait plus rien du tout.
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
            toFetch.forEach((t, index) => cache.set(t.id, previews[index]))
        }
        successCount += batch.filter((t) => cache.get(t.id)).length
    }
    // signal utile pour un futur diagnostic (rate limiting externe, pool sans
    // assez d'extraits...) sans le détail par lot, trop verbeux au quotidien
    console.log(
        `⏱️ [${code}] prefetchPreviews : ${successCount}/${tried} extraits trouvés (cible ${successTarget}, plafond ${maxSize})`
    )
    return cache
}

const resolvePreviewCached = async (track, previewCache) => {
    if (previewCache.has(track.id)) return previewCache.get(track.id)
    const previewUrl = await resolvePreviewUrl(track)
    previewCache.set(track.id, previewUrl)
    return previewUrl
}

// chauffage de fond : lot plus PETIT que PREVIEW_PREFETCH_BATCH_SIZE (aucune
// urgence ici, contrairement au lancement) + pause entre les lots, pour ne
// jamais consommer à lui seul le débit externe disponible pendant que les
// joueurs patientent — un lobby peut rester ouvert plusieurs minutes, la
// somme des requêtes envoyées compte autant que leur simultanéité
const PREVIEW_WARM_BATCH_SIZE = 5
const PREVIEW_WARM_BATCH_DELAY_MS = 200
// plafond : inutile de chauffer un pool de plusieurs milliers de titres
// (bibliothèques Deezer réelles) quand une partie n'en retient jamais plus
// qu'un petit multiple du nombre de manches maximum — cf. la même logique de
// plafond que prefetchPreviews (PREVIEW_PREFETCH_MAX_FACTOR), mais calculée
// sur LOBBY_LIMITS.MAX_ROUNDS puisque le nombre de manches réel n'est pas
// encore connu pendant l'attente au lobby (l'hôte peut encore le changer)
const PREVIEW_WARM_MAX_TRACKS = LOBBY_LIMITS.MAX_ROUNDS * PREVIEW_PREFETCH_MAX_FACTOR

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

// pré-chauffe un préfixe borné du pool en tâche de fond PENDANT l'attente au
// lobby (déclenché à chaque soumission de musiques, cf. submitTracks) plutôt
// qu'au moment où l'hôte clique sur "Lancer" : alimente le même
// `game.previewCache` que prefetchPreviews, donc un lancement qui arrive
// après que ce chauffage a eu le temps de tourner ne fait (idéalement) plus
// aucun appel réseau pour ce préfixe.
//
// S'arrête dès que `game.launching` passe à true (cf. startGame) : sans ça,
// un pool volumineux pas encore entièrement chauffé au moment du clic sur
// "Lancer" continuait de tourner EN MÊME TEMPS que prefetchPreviews — deux
// boucles tapant Deezer/iTunes en parallèle, qui se marchaient dessus et
// déclenchaient un vrai rate limiting externe (constaté en conditions
// réelles : des lots entiers à 0 succès alors que les titres avaient bien un
// extrait disponible). Le chemin critique du lancement doit être seul à
// consommer le débit externe à ce moment précis.
//
// Une seule passe à la fois par partie (cf. game.previewWarming) : `pool` est
// recalculé à CHAQUE lot plutôt qu'une fois pour toutes en tête de fonction,
// donc un nouveau joueur qui soumet ses musiques pendant que la boucle
// tourne déjà voit son pool absorbé par la passe en cours, sans qu'il soit
// besoin d'empiler une seconde passe concurrente.
const warmPreviewCache = async (code, game) => {
    if (game.previewWarming || game.launching) return
    game.previewWarming = true
    try {
        let i = 0
        // ne reconstruit le pool que quand le nombre de joueurs ayant soumis
        // a changé (une nouvelle soumission peut arriver pendant que la
        // boucle tourne déjà, cf. plus haut) : évite de refaire le merge
        // à chaque lot pour rien sur un gros pool
        let pool = buildPool(game)
        let trackedSubmissionCount = game.submittedTracks.size
        while (games.get(code) === game && !game.launching) {
            if (game.submittedTracks.size !== trackedSubmissionCount) {
                // ordre de constitution du pool (pas mélangé) : le tirage réel
                // au lancement, lui, reste un vrai hasard à chaque partie (cf.
                // buildBlindtestRounds/buildWhoLikedRounds) — sur un gros
                // pool, ce chauffage ne recoupe donc qu'une partie de ce qui
                // sera nécessaire, mais on privilégie ici la variété des
                // manches plutôt qu'un alignement parfait
                pool = buildPool(game)
                trackedSubmissionCount = game.submittedTracks.size
            }
            if (i >= pool.length || i >= PREVIEW_WARM_MAX_TRACKS) break

            const batch = pool.slice(i, i + PREVIEW_WARM_BATCH_SIZE).filter((t) => !game.previewCache.has(t.id))
            i += PREVIEW_WARM_BATCH_SIZE
            if (batch.length === 0) continue

            const previews = await Promise.all(batch.map((t) => resolvePreviewUrl(t)))
            batch.forEach((t, index) => game.previewCache.set(t.id, previews[index]))
            await sleep(PREVIEW_WARM_BATCH_DELAY_MS)
        }
    } finally {
        game.previewWarming = false
    }
}

// mode who_liked (Who Liked It) : le titre est toujours affiché (ce n'est pas
// ce qu'on devine), on privilégie juste les musiques qui ont un extrait sans
// que ce soit bloquant.
//
// Équité, en deux temps :
// 1. Couverture (triée par byCoverageDesc, inchangé) : réserve un titre par
//    joueur pas encore représenté, pour que tout le monde apparaisse au moins
//    une fois. Ces manches sont toujours conservées telles quelles.
// 2. Part de manches (même mécanisme que buildBlindtestRounds/byFairness,
//    cf. FAIRNESS_MAX_SHARE_FACTOR) : au-delà de cette couverture minimale,
//    aucun joueur ne peut voir SES titres exclusifs (ceux qu'il est seul à
//    avoir likés, cf. exclusiveOwner) dépasser FAIRNESS_MAX_SHARE_FACTOR × sa
//    part "juste" des manches (~60% à 2 joueurs) — sans quoi un joueur à
//    grosse bibliothèque finissait par y apparaître beaucoup plus souvent que
//    les autres, alors que ce mode n'a même pas besoin d'un extrait pour
//    tourner, ce qui accentuait encore l'effet à bibliothèques inégales.
const buildWhoLikedRounds = async (game, pool, requestedRounds, activePlayerIds) => {
    const shuffledPool = shuffle(pool)
    const previewCache = await prefetchPreviews(game, shuffledPool, requestedRounds)
    const used = new Set()
    const fairnessRounds = []
    const uncovered = new Set(activePlayerIds)
    const fairnessMax = Math.ceil((requestedRounds / activePlayerIds.length) * FAIRNESS_MAX_SHARE_FACTOR)
    const ownerRoundCounts = new Map(activePlayerIds.map((id) => [id, 0]))

    const buildRound = async (track) => {
        const likedBy = [...track.likedBy].filter((id) => activePlayerIds.includes(id))
        if (likedBy.length === 0) return null
        const previewUrl = await resolvePreviewCached(track, previewCache)
        return { round: { track: { ...track, previewUrl }, likedBy }, previewUrl, likedBy }
    }

    const registerPick = (track, likedBy) => {
        used.add(track.id)
        for (const id of likedBy) uncovered.delete(id)
        const owner = exclusiveOwner(track, activePlayerIds)
        if (owner) ownerRoundCounts.set(owner, (ownerRoundCounts.get(owner) ?? 0) + 1)
    }

    for (const track of byCoverageDesc(shuffledPool, activePlayerIds)) {
        if (fairnessRounds.length >= requestedRounds || uncovered.size === 0) break
        if (![...track.likedBy].some((id) => uncovered.has(id))) continue

        const result = await buildRound(track)
        if (!result) continue

        registerPick(track, result.likedBy)
        fairnessRounds.push(result.round)
    }

    // pour chaque manche restante, priorise les candidats dont le
    // propriétaire exclusif a le moins de manches jusqu'ici (cf. byFairness) ;
    // retente sans le plafond d'équité seulement si plus aucun candidat n'est
    // éligible en-dessous (pool exclusif d'un joueur épuisé). La préférence
    // pour un extrait ne coûte AUCUN appel réseau supplémentaire : elle ne
    // regarde que ce qui est déjà en cache (cf. game.previewCache, chauffé en
    // amont par prefetchPreviews/warmPreviewCache) — contrairement à
    // buildBlindtestRounds, ce mode n'a pas besoin d'extrait pour tourner,
    // donc pas question de faire une recherche réseau exhaustive juste pour
    // en trouver un ; le premier candidat éligible fait l'affaire sinon.
    const remainingSlots = requestedRounds - fairnessRounds.length
    const rounds = []

    for (let i = 0; i < remainingSlots; i += 1) {
        const pick = async (respectMax) => {
            const candidates = byFairness(
                shuffledPool,
                activePlayerIds,
                ownerRoundCounts,
                fairnessMax,
                respectMax
            ).filter((t) => !used.has(t.id))
            if (candidates.length === 0) return null

            const cachedWithPreview = candidates.find((t) => previewCache.get(t.id))
            const result = await buildRound(cachedWithPreview ?? candidates[0])
            return result ? { track: cachedWithPreview ?? candidates[0], result } : null
        }

        const picked = (await pick(true)) ?? (await pick(false))
        if (!picked) break // plus aucun titre disponible, quel qu'il soit

        registerPick(picked.track, picked.result.likedBy)
        rounds.push(picked.result.round)
    }

    return [...fairnessRounds, ...rounds].slice(0, requestedRounds)
}

// pioche jusqu'à `count` manches dans `candidates` (déjà mélangés/triés),
// extrait audio requis (repli vers le titre suivant sinon) ; `used` est
// partagé entre tous les appels d'une même partie pour ne jamais reproposer
// un titre déjà retenu pour une autre manche
const takeRounds = async (candidates, count, used, previewCache) => {
    const rounds = []
    for (const track of candidates) {
        if (rounds.length >= count) break
        if (used.has(track.id)) continue

        const previewUrl = await resolvePreviewCached(track, previewCache)
        if (!previewUrl) continue

        used.add(track.id)
        rounds.push({ track: { ...track, previewUrl } })
    }
    return rounds
}

// propriétaire exclusif d'un titre parmi les joueurs actifs : null si liké
// par plusieurs d'entre eux (titre "partagé", cf. buildPool) — un titre
// partagé ne compte pour personne dans l'équité ci-dessous, il ne pénalise ni
// n'avantage aucun joueur
const exclusiveOwner = (track, activePlayerIds) => {
    const likers = [...track.likedBy].filter((id) => activePlayerIds.includes(id))
    return likers.length === 1 ? likers[0] : null
}

// filtre `candidates` (déjà mélangés) pour l'équité inter-comptes (cf.
// FAIRNESS_MAX_SHARE_FACTOR, constants.js) : écarte seulement un titre dont
// le propriétaire exclusif a déjà atteint son plafond de manches (si
// `respectMax` est vrai — l'appelant retente ensuite sans ce filtre plutôt
// que de laisser une manche vide, cf. pickFairestRound), SANS reclasser le
// reste par priorité. Une première version triait par "propriétaire le moins
// représenté d'abord" (un vrai tourniquet) : ça respectait bien le plafond,
// mais produisait un ping-pong strict et prévisible à chaque manche (1, 2, 1,
// 2, 1, 2...) — repéré en conditions réelles sur un lobby à 2 comptes très
// déséquilibrés (1800 vs 600 titres likés), où l'alternance était
// systématique malgré l'écart de bibliothèque. En ne filtrant QUE par le
// plafond et en laissant l'ordre du mélange d'origine (`candidates`) décider
// qui vient ensuite, l'enchaînement redevient imprévisible (des séries de
// plusieurs manches d'affilée pour un même compte sont possibles) tout en
// gardant la même garantie dure : personne ne peut dépasser
// FAIRNESS_MAX_SHARE_FACTOR × sa part "juste" sur l'ensemble de la partie. Un
// titre partagé (owner null) n'est jamais écarté par ce filtre.
const byFairness = (candidates, activePlayerIds, ownerRoundCounts, fairnessMax, respectMax) =>
    candidates.filter((track) => {
        const owner = exclusiveOwner(track, activePlayerIds)
        return !owner || !respectMax || (ownerRoundCounts.get(owner) ?? 0) < fairnessMax
    })

// mode blindtest : on devine le titre, donc un extrait est indispensable ;
// le tirage est complètement aléatoire dans le pool, sans autre contrainte.
// Un tirage naïf dans le pool mélangé reflète directement la taille des
// bibliothèques likées : un compte à 1800 titres écrase un compte à 600
// (~70/30 constaté en pratique, cf. FAIRNESS_MAX_SHARE_FACTOR). Chaque
// manche est donc choisie via pickFairestRound, qui priorise/écarte les
// titres selon la part de manches déjà attribuées exclusivement à chaque
// joueur (cf. byFairness).
const buildBlindtestRounds = async (game, pool, requestedRounds, activePlayerIds) => {
    const shuffledPool = shuffle(pool)
    const previewCache = await prefetchPreviews(game, shuffledPool, requestedRounds)
    const used = new Set()

    const fairnessMax = Math.ceil((requestedRounds / activePlayerIds.length) * FAIRNESS_MAX_SHARE_FACTOR)
    const ownerRoundCounts = new Map(activePlayerIds.map((id) => [id, 0]))

    const rounds = []
    for (let i = 0; i < requestedRounds; i += 1) {
        const order = (respectMax) => byFairness(shuffledPool, activePlayerIds, ownerRoundCounts, fairnessMax, respectMax)

        let [picked] = await takeRounds(order(true), 1, used, previewCache)
        // plafond intenable (pool exclusif de l'autre joueur épuisé) : on
        // retente sans le filtre plutôt que de laisser la manche vide
        if (!picked) [picked] = await takeRounds(order(false), 1, used, previewCache)

        if (!picked) continue
        // sinon : plus aucun titre disponible avec extrait, cette manche est
        // simplement absente (cf. MIN_ROUNDS_PLAYABLE côté appelant)

        const owner = exclusiveOwner(picked.track, activePlayerIds)
        if (owner) ownerRoundCounts.set(owner, (ownerRoundCounts.get(owner) ?? 0) + 1)
        rounds.push(picked)
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
// des options imposées). L'artiste est celui déjà transmis par le client (pas
// encore enrichi des featurings) : aucun appel réseau ici, pour que la taille
// du pool (qui grandit avec le nombre de joueurs) n'ait plus aucun impact sur
// le temps de lancement — cf. enrichCatalogInBackground pour l'enrichissement.
const buildCatalog = (pool) => pool.map((t) => ({ id: t.id, name: t.name, artist: t.artist, image: t.image ?? null }))

// enrichit l'artiste de chaque titre Deezer avec les featurings (cf.
// resolveDeezerArtist), pour que "je cherche Pharrell Williams" retrouve un
// titre de Tyler, The Creator feat. Pharrell Williams. Volontairement mené
// APRÈS "game:started"/le lancement de la première manche (jamais attendu par
// startGame) : par lots (pour ménager l'API Deezer publique), donc
// proportionnel à la taille du pool — bloquant le lancement, ce délai grandissait
// avec le nombre de joueurs (chacun ajoutant ses titres likés au pool commun),
// ce qui causait les débuts de partie de plus en plus lents rapportés à mesure
// que les lobbys s'agrandissent.
const enrichCatalogInBackground = async (code, game, pool, io) => {
    for (let i = 0; i < pool.length; i += DEEZER_ARTIST_BATCH_SIZE) {
        // la partie a pu être relancée (rejouer) ou nettoyée entre-temps : ne
        // diffuse plus rien dans ces cas, ce serait soit obsolète soit destiné
        // à une room qui n'écoute plus cet enrichissement précis
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

    // à partir d'ici le lancement est acté : stoppe le pré-chauffage de fond
    // (cf. warmPreviewCache) avant de faire nous-mêmes des appels réseau pour
    // les extraits, sans quoi les deux tapent Deezer/iTunes en parallèle et
    // se marchent dessus (constaté en conditions réelles : rate limiting
    // externe, extraits qui ne se résolvent plus du tout pendant plusieurs
    // lots alors qu'ils existent bel et bien)
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
