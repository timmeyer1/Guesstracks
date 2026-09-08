// Résout un extrait audio de 30s pour une musique.
//
// On n'héberge et ne proxy jamais de contenu Spotify/Deezer nous-mêmes : si le
// client a transmis le previewUrl que Spotify a lui-même renvoyé dans sa
// réponse (souvent absent depuis le durcissement de l'API fin 2024), on le
// garde tel quel. Sinon on retombe d'abord sur la recherche publique de
// Deezer (aucune authentification requise, catalogue large et récent —
// meilleur taux de correspondance qu'iTunes en pratique), puis sur l'iTunes
// Search API en dernier recours : un service public d'Apple, sans
// authentification, explicitement prévu pour fournir des extraits de 30s —
// donc pas de risque de dépasser les conditions d'usage de Spotify ou Deezer
// dans les deux cas. Si rien n'est trouvé, la manche se joue sans audio.
import { fetchFreshDeezerPreview } from './deezer.service.js'
import { normalizeTrackText } from '../utils/normalizeTrackText.js'
import { getVerifiedMatch, saveVerifiedMatch } from './previewMatch.service.js'

// ré-exportée telle quelle pour game.service.js (regroupement du pool par
// identité nom+artiste, cf. poolKey) — définie dans utils/normalizeTrackText.js
// pour éviter un import circulaire avec previewMatch.service.js ci-dessus
export { normalizeTrackText }

const DEEZER_SEARCH_URL = 'https://api.deezer.com/search'
const ITUNES_SEARCH_URL = 'https://itunes.apple.com/search'

// les extraits Deezer (renvoyés par searchDeezerPreview ci-dessous, y compris
// depuis ce repli iTunes indirectement puisqu'un titre Deezer testé plus tôt
// peut être re-résolu) sont des URLs signées valables ~15 minutes seulement
// après leur émission (cf. deezer.service.js) : un cache sans expiration
// finissait par ne renvoyer que des liens morts. 10 min de marge sous les ~15
// observées.
const CACHE_TTL_MS = 10 * 60 * 1000

const cache = new Map() // clé "titre::artiste" -> { url, resolvedAt } | { url: null, resolvedAt }

const cacheKey = (name, artist) => `${name}`.trim().toLowerCase() + '::' + `${artist}`.trim().toLowerCase()

const normalize = normalizeTrackText

// iTunes et Deezer font tous les deux de la recherche floue et renvoient
// parfois un titre totalement différent en première position (ex: "Fever" -
// Buckshot -> "A Fever Guttering in the Ribs" - DEAD EYES BASTARD) : on ne
// fait confiance à un résultat que si son titre ET son artiste correspondent
// réellement, sinon on préfère ne pas avoir d'extrait plutôt qu'un mauvais
// extrait. Cette validation compare toujours au nom D'ORIGINE (jamais à la
// version "nettoyée" utilisée pour la requête, cf. searchTermVariants) : les
// variantes de requête ci-dessous ne peuvent donc jamais faire remonter un
// mauvais extrait, seulement en trouver un que la requête brute aurait raté.
// `requireArtist: false` (cf. searchDeezerPreview/searchItunesPreview) :
// dernier recours quand aucun résultat ne passe la validation stricte —
// une collaboration peut être cataloguée par Deezer/iTunes sous un artiste
// différent de celui sous lequel le joueur l'a likée (ex: "Lean On" listé
// sous "Major Lazer", liké par un joueur sous "DJ Snake" seul) ; le titre
// reste strictement validé, seul l'artiste n'est plus une condition
// bloquante. Risque assumé : jouer occasionnellement le mauvais extrait sur
// un titre homonyme ambigu, en échange de moins de manches sans aucun son.
// en dessous de cette longueur (normalisée), un titre est trop générique pour
// que "l'un contient l'autre" veuille dire quoi que ce soit : "LA" (Aminé)
// est une sous-chaîne de bien trop de titres pour que ça prouve une
// correspondance — vécu en conditions réelles, "LA" d'Aminé a fait remonter
// "Elle est là" d'un artiste homonyme sans accent ("Amine"), un titre
// totalement différent. En dessous du seuil, on exige une égalité stricte.
const MIN_FUZZY_TITLE_LENGTH = 4

const isRealMatch = (name, artist, gotName, gotArtist, { requireArtist = true } = {}) => {
    const wantedName = normalize(name)
    const normGotName = normalize(gotName || '')

    if (!normGotName || !wantedName) return false
    // quand l'artiste n'est PAS vérifié (requireArtist: false, cf. plus bas),
    // on exige une égalité STRICTE du titre plutôt que la correspondance
    // floue habituelle (contenu l'un dans l'autre) : un titre déjà flou
    // combiné à un artiste totalement ignoré cumule deux sources d'erreur à
    // la fois, ce que le cas légitime (duo mal catalogué, cf. plus bas) n'a
    // jamais besoin — son titre y correspond déjà exactement.
    const canFuzzyMatch =
        requireArtist &&
        wantedName.length >= MIN_FUZZY_TITLE_LENGTH &&
        normGotName.length >= MIN_FUZZY_TITLE_LENGTH
    const nameMatches =
        normGotName === wantedName ||
        (canFuzzyMatch && (normGotName.includes(wantedName) || wantedName.includes(normGotName)))
    if (!nameMatches) return false

    if (!requireArtist) return true

    const wantedArtist = normalize(artist)
    if (!wantedArtist) return true
    const normGotArtist = normalize(gotArtist || '')
    return normGotArtist.includes(wantedArtist) || wantedArtist.includes(normGotArtist)
}

// Spotify (et Apple Music) laissent souvent dans le titre un suffixe absent
// du catalogue Deezer/iTunes — "(Remastered 2011)", "(Live)", "(Deluxe
// Edition)", "- Radio Edit"... — qui fait échouer la recherche floue même
// quand le titre existe bel et bien chez eux : testé en pratique, la requête
// brute renvoie alors un résultat sans rapport (ex: un enregistrement live
// obscur) plutôt que le titre studio, qu'isRealMatch rejette à raison,
// laissant le titre sans extrait pour de bon.
const NOISE_SUFFIX =
    /\s*[-–—([]\s*(remaster(ed)?(\s*\d{4})?|live|deluxe(\s*edition)?|single version|radio edit|album version|acoustic|mono|stereo|explicit|clean|bonus track|extended(\s*mix)?|anniversary edition|edit)\b.*$/i

const stripNoise = (name) => `${name}`.replace(NOISE_SUFFIX, '').trim()

// titre brut d'abord (le cas courant), puis sa version nettoyée en repli
// seulement si elle diffère réellement du titre brut
const searchTermVariants = (name) => {
    const cleaned = stripNoise(name)
    return cleaned && cleaned !== name ? [name, cleaned] : [name]
}

const SEARCH_RESULT_LIMIT = 10

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
// délais avant de retenter Deezer après un quota dépassé (cf. searchDeezerOnce
// / searchDeezerPreview), croissants : un seul retry à délai court s'est
// avéré insuffisant en conditions de charge réelle (vérifié : une rafale de
// 60 requêtes simultanées laisse le quota encore dépassé 1.2s plus tard, le
// retry échouait alors lui aussi et retombait sur iTunes, moins fiable). On
// préfère patienter davantage plutôt que de risquer un mauvais extrait —
// Deezer reste la source la plus fiable (cf. tête de fichier).
const RETRY_DELAYS_MS = [1200, 3000]

const fetchJson = async (url) => {
    try {
        const controller = new AbortController()
        const timeout = setTimeout(() => controller.abort(), 5000)
        const res = await fetch(url, { signal: controller.signal })
        clearTimeout(timeout)
        if (!res.ok) return null
        return await res.json()
    } catch {
        return null
    }
}

const searchDeezerOnce = async (query) => {
    if (!query) return []
    const url = new URL(DEEZER_SEARCH_URL)
    url.searchParams.set('q', query)
    url.searchParams.set('limit', String(SEARCH_RESULT_LIMIT))
    const data = await fetchJson(url)
    // `null` distingue un échec à retenter (réseau/timeout, cf. fetchJson —
    // ou quota Deezer dépassé, cf. juste en dessous) d'une réponse reçue avec
    // zéro résultat : sert à savoir si searchDeezerPreview doit retenter (cf.
    // juste en dessous), pas à retenter pour un titre légitimement absent du
    // catalogue Deezer.
    // Deezer répond en HTTP 200 (donc `fetchJson` ne le traite PAS comme un
    // échec) avec `{ error: { message: "Quota limit exceeded", ... } }` en
    // cas de rate limiting — vérifié empiriquement (60 requêtes en parallèle
    // suffisent à le déclencher). Sans ce contrôle, une réponse de quota
    // dépassé était comptée comme "zéro résultat légitime" et ne déclenchait
    // JAMAIS le retry ci-dessous, aussi fréquente soit la cause réelle du
    // rate limiting.
    if (!data || data.error) return null
    return data.data || []
}

// retente une fois les requêtes Deezer en échec réseau (timeout, rate
// limiting externe — déjà documenté comme fréquent pendant une rafale de
// résolutions en parallèle, cf. prefetchPreviews/warmPreviewCache) avant de
// se rabattre sur iTunes : un échec Deezer pur et simple prive le titre de
// son résultat le plus fiable et fait retomber sur le repli iTunes
// `requireArtist: false` (cf. isRealMatch), qui peut alors valider un titre
// homonyme sans rapport. Vécu en conditions réelles : "Reel It In" d'Aminé
// (bien présent sur Deezer sous l'orthographe "Amine", vérifié manuellement)
// a joué l'extrait de "reel it in" par "home alone.", un résultat iTunes sans
// rapport, après un échec Deezer. Ne retente PAS quand Deezer a répondu avec
// zéro résultat (titre légitimement absent) — seulement sur échec réseau.
const searchDeezerPreview = async (name, artist) => {
    if (!name && !artist) return null

    // pour chaque variante de titre (brut, puis nettoyé si différent), deux
    // requêtes en parallèle : la syntaxe à champs de Deezer (artist:"X"
    // track:"Y"), plus précise que le texte libre car elle classe en tête les
    // correspondances exactes de métadonnées, et une requête texte libre en
    // complément (le champ échoue parfois sur des caractères spéciaux)
    const queries = searchTermVariants(name).flatMap((term) => {
        const plainQuery = `${term} ${artist}`.trim()
        if (!plainQuery) return []
        const fieldQuery = artist ? `artist:"${artist}" track:"${term}"` : plainQuery
        return [fieldQuery, plainQuery]
    })
    if (queries.length === 0) return null

    let resultSets = await Promise.all(queries.map(searchDeezerOnce))
    for (const delayMs of RETRY_DELAYS_MS) {
        if (!resultSets.some((r) => r === null)) break
        // laisse passer un peu de temps avant de retenter : le quota Deezer
        // (cf. searchDeezerOnce) se rouvre sur une fenêtre glissante de
        // quelques secondes — retenter immédiatement retombe souvent dans la
        // même fenêtre encore pleine et échoue à nouveau pour rien
        await sleep(delayMs)
        resultSets = await Promise.all(queries.map(searchDeezerOnce))
    }
    const safeResultSets = resultSets.map((r) => r || [])

    // `strict: true` <-> le match a passé isRealMatch AVEC vérification de
    // l'artiste (première boucle) ; distingue les deux boucles ci-dessous pour
    // resolvePreviewUrl, qui n'enregistre en base permanente (cf.
    // previewMatch.service.js/saveVerifiedMatch) que les matches stricts —
    // jamais ceux du repli `requireArtist: false`, déjà risqués au moment même
    // où ils sont trouvés
    for (const results of safeResultSets) {
        const match = results.find((candidate) => isRealMatch(name, artist, candidate.title, candidate.artist?.name))
        if (match?.preview) {
            return {
                preview: match.preview,
                provider: 'deezer',
                providerId: match.id,
                title: match.title,
                artist: match.artist?.name,
                strict: true,
            }
        }
    }
    // dernier recours, sur les MÊMES résultats déjà récupérés (aucune requête
    // réseau de plus) : titre seul, sans exiger la correspondance d'artiste
    // (cf. isRealMatch)
    for (const results of safeResultSets) {
        const match = results.find((candidate) =>
            isRealMatch(name, artist, candidate.title, candidate.artist?.name, { requireArtist: false })
        )
        if (match?.preview) {
            return {
                preview: match.preview,
                provider: 'deezer',
                providerId: match.id,
                title: match.title,
                artist: match.artist?.name,
                strict: false,
            }
        }
    }
    return null
}

// le storefront iTunes interrogé dépend du paramètre `country` — sans lui,
// l'API retombe sur le catalogue US par défaut, qui n'a pas forcément les
// mêmes titres (droits différents par pays) que le catalogue FR. Codé en dur
// pour l'instant (le public visé est francophone) plutôt que déduit du
// compte/téléphone du joueur : demanderait de faire remonter sa région
// jusqu'ici (payload de soumission des titres, cf. game.service.js) pour un
// gain incertain tant qu'on n'a pas mesuré si ça change vraiment le taux de
// succès en pratique.
const ITUNES_STOREFRONT_COUNTRY = 'FR'

const searchItunesOnce = async (term) => {
    if (!term) return []
    const url = new URL(ITUNES_SEARCH_URL)
    url.searchParams.set('term', term)
    url.searchParams.set('entity', 'song')
    url.searchParams.set('country', ITUNES_STOREFRONT_COUNTRY)
    url.searchParams.set('limit', String(SEARCH_RESULT_LIMIT))
    const data = await fetchJson(url)
    return data?.results || []
}

const searchItunesPreview = async (name, artist) => {
    if (!name && !artist) return null

    const queries = searchTermVariants(name)
        .map((term) => `${term} ${artist}`.trim())
        .filter(Boolean)
    if (queries.length === 0) return null

    const resultSets = await Promise.all(queries.map(searchItunesOnce))
    for (const results of resultSets) {
        const match = results.find((candidate) => isRealMatch(name, artist, candidate.trackName, candidate.artistName))
        if (match?.previewUrl) {
            return {
                preview: match.previewUrl,
                provider: 'itunes',
                providerId: match.trackId,
                title: match.trackName,
                artist: match.artistName,
                strict: true,
            }
        }
    }
    // dernier recours, sur les MÊMES résultats déjà récupérés (aucune requête
    // réseau de plus) : titre seul, sans exiger la correspondance d'artiste
    // (cf. isRealMatch)
    for (const results of resultSets) {
        const match = results.find((candidate) =>
            isRealMatch(name, artist, candidate.trackName, candidate.artistName, { requireArtist: false })
        )
        if (match?.previewUrl) {
            return {
                preview: match.previewUrl,
                provider: 'itunes',
                providerId: match.trackId,
                title: match.trackName,
                artist: match.artistName,
                strict: false,
            }
        }
    }
    return null
}

// contrepartie iTunes de fetchFreshDeezerPreview (deezer.service.js) : un
// lookup par id direct coûte 1 requête, sans recherche floue — utilisée par
// resolvePreviewUrl pour rafraîchir un match iTunes déjà vérifié (cf.
// previewMatch.service.js), au lieu de repartir sur searchItunesPreview.
// Revalidée comme toute autre source (cf. isRealMatch côté appelant) : un id
// peut en théorie lui aussi avoir été réattribué entre-temps.
const ITUNES_LOOKUP_URL = 'https://itunes.apple.com/lookup'

const fetchFreshItunesPreview = async (trackId) => {
    const url = new URL(ITUNES_LOOKUP_URL)
    url.searchParams.set('id', String(trackId))
    url.searchParams.set('country', ITUNES_STOREFRONT_COUNTRY)
    const data = await fetchJson(url)
    const result = data?.results?.[0]
    if (!result?.previewUrl) return null
    return { preview: result.previewUrl, title: result.trackName, artist: result.artistName }
}

// dispatcher provider-agnostique utilisé par resolvePreviewUrl pour
// rafraîchir un match déjà vérifié (cf. previewMatch.service.js) : 1 requête
// par id, jamais de recherche floue
const fetchFreshByProviderId = async (provider, providerId) => {
    if (provider === 'deezer') return fetchFreshDeezerPreview(providerId)
    if (provider === 'itunes') return fetchFreshItunesPreview(providerId)
    return null
}

// track: { name, artist, previewUrl?, provider?, id? }
export const resolvePreviewUrl = async (track) => {
    // Un titre Deezer a toujours un id Deezer réel (track.id) : on peut donc
    // toujours en récupérer un extrait tout frais directement, plutôt que de
    // faire confiance à track.previewUrl (celui que le client a transmis à sa
    // connexion, potentiellement déjà périmé, cf. deezer.service.js) ou à un
    // extrait mis en cache par une résolution précédente. On valide quand
    // même titre+artiste (comme pour toute autre source, cf. isRealMatch) :
    // un id peut avoir été réassigné à une autre fiche côté Deezer entre la
    // soumission du joueur et maintenant — vécu en conditions réelles,
    // "METAMORPHOSIS - Sped Up" d'INTERWORLD a joué l'extrait de "Freaking
    // Out A Bit" de Goldfinger, un titre sans aucun rapport, en faisant
    // confiance à l'id sans vérifier ce qu'il désignait vraiment.
    if (track.provider === 'deezer' && track.id) {
        const fresh = await fetchFreshDeezerPreview(track.id)
        if (fresh && isRealMatch(track.name, track.artist, fresh.title, fresh.artist)) return fresh.preview
        // repli si le titre a disparu du catalogue Deezer entre-temps, ou si
        // l'id ne correspond plus au bon titre — continue vers
        // previewUrl/le cache/la recherche ci-dessous
    }

    if (track.previewUrl) return track.previewUrl

    const key = cacheKey(track.name, track.artist)
    const cached = cache.get(key)
    if (cached && Date.now() - cached.resolvedAt < CACHE_TTL_MS) return cached.url

    // base globale (partagée entre TOUTES les parties, cf.
    // previewMatch.service.js) de correspondances déjà vérifiées par une
    // résolution précédente, potentiellement dans une autre partie : 1 seule
    // requête (par id, pas de recherche floue) au lieu des ~4 d'une recherche
    // complète ci-dessous. Revalidée comme toute autre source (cf.
    // isRealMatch) : un id peut avoir été réattribué entre-temps.
    const verified = await getVerifiedMatch(track.name, track.artist)
    if (verified) {
        const fresh = await fetchFreshByProviderId(verified.provider, verified.providerId)
        if (fresh && isRealMatch(track.name, track.artist, fresh.title, fresh.artist)) {
            cache.set(key, { url: fresh.preview, resolvedAt: Date.now() })
            return fresh.preview
        }
        // entrée périmée (titre disparu du catalogue, id réattribué...) :
        // retombe sur la recherche complète ci-dessous, qui écrasera cette
        // entrée avec un nouveau match si elle réussit
    }

    const result =
        (await searchDeezerPreview(track.name, track.artist)) ?? (await searchItunesPreview(track.name, track.artist))
    const url = result?.preview ?? null
    // ne met en cache qu'un VRAI extrait trouvé : un échec est souvent
    // temporaire (rate limiting Deezer/iTunes pendant une rafale de
    // résolutions en parallèle, cf. prefetchPreviews/warmPreviewCache côté
    // game.service.js — déjà constaté en conditions réelles), alors que la
    // même recherche, retentée un peu plus tard sans la même charge, retrouve
    // souvent l'extrait sans problème. Mettre un échec en cache l'aurait
    // gravé pour CACHE_TTL_MS (10 min) même quand le titre est bel et bien
    // disponible, condamnant la manche à rester muette pour rien.
    if (url) {
        cache.set(key, { url, resolvedAt: Date.now() })
        // n'enregistre en base PERMANENTE (partagée entre toutes les parties
        // futures) que les matches stricts (cf. searchDeezerPreview/
        // searchItunesPreview) — jamais ceux du repli sans artiste, déjà
        // risqués au moment même où on les trouve (cf. isRealMatch). Ni
        // attendue ni bloquante : un hoquet Mongo ne doit jamais retarder la
        // manche (cf. previewMatch.service.js).
        if (result.strict) {
            saveVerifiedMatch(track.name, track.artist, result.provider, result.providerId, result.title, result.artist)
        }
    }
    return url
}
