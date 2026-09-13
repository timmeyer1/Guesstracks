// trouve un extrait audio de 30s pour une musique.
//
// on héberge et proxy jamais de contenu Spotify/Deezer nous-mêmes. si le
// client a déjà un previewUrl fourni par Spotify, on le garde tel quel.
// sinon on cherche sur Deezer (public, pas de compte requis, meilleur taux
// de succès), et en dernier recours sur l'iTunes Search API (public aussi,
// fait justement pour des extraits de 30s). si rien trouvé, pas de son sur la manche.
import { fetchFreshDeezerPreview } from './deezer.service.js'
import { normalizeTrackText } from '../utils/normalizeTrackText.js'
import { getVerifiedMatch, saveVerifiedMatch } from './previewMatch.service.js'

// ré-exportée pour game.service.js (poolKey). elle vit dans
// utils/normalizeTrackText.js pour éviter un import circulaire avec previewMatch.service.js
export { normalizeTrackText }

const DEEZER_SEARCH_URL = 'https://api.deezer.com/search'
const ITUNES_SEARCH_URL = 'https://itunes.apple.com/search'

// les extraits Deezer sont des URLs signées qui expirent après ~15 min (voir
// deezer.service.js). sans expiration, le cache finirait par renvoyer des
// liens morts. 10 min de marge par rapport aux ~15 observées.
const CACHE_TTL_MS = 10 * 60 * 1000

const cache = new Map() // clé "titre::artiste" -> { url, resolvedAt } | { url: null, resolvedAt }

const cacheKey = (name, artist) => `${name}`.trim().toLowerCase() + '::' + `${artist}`.trim().toLowerCase()

const normalize = normalizeTrackText

// iTunes et Deezer font de la recherche floue et peuvent renvoyer un titre
// totalement différent en tête (ex: "Fever" de Buckshot -> un titre sans
// rapport d'un autre artiste). on valide donc que titre ET artiste
// correspondent vraiment, sinon on préfère pas d'extrait qu'un mauvais.
// `requireArtist: false` sert de dernier recours : une collab peut être
// cataloguée sous un autre artiste que celui liké par le joueur (ex: "Lean
// On" sous "Major Lazer" alors qu'un joueur l'a liké sous "DJ Snake"). on
// accepte alors le risque d'un mauvais extrait homonyme, plutôt qu'aucun son.
// en dessous de cette longueur, un titre trop court/générique ("LA" d'Aminé)
// matche n'importe quoi par erreur — donc en dessous du seuil, égalité stricte exigée.
const MIN_FUZZY_TITLE_LENGTH = 4

const isRealMatch = (name, artist, gotName, gotArtist, { requireArtist = true } = {}) => {
    const wantedName = normalize(name)
    const normGotName = normalize(gotName || '')

    if (!normGotName || !wantedName) return false
    // quand l'artiste n'est pas vérifié, on exige une égalité stricte du
    // titre plutôt que la correspondance floue habituelle : sinon on cumule
    // deux sources d'erreur (titre flou + artiste ignoré) pour rien, le cas
    // légitime (duo mal catalogué) a de toute façon un titre qui matche exactement
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

// Spotify/Apple Music laissent souvent des suffixes dans le titre
// ("(Remastered 2011)", "(Live)", "- Radio Edit"...) qui existent pas chez
// Deezer/iTunes. sans nettoyage, la recherche renvoie un résultat sans
// rapport (ex: un live obscur) qu'isRealMatch rejette à raison, et le titre reste sans extrait.
const NOISE_SUFFIX =
    /\s*[-–—([]\s*(remaster(ed)?(\s*\d{4})?|live|deluxe(\s*edition)?|single version|radio edit|album version|acoustic|mono|stereo|explicit|clean|bonus track|extended(\s*mix)?|anniversary edition|edit)\b.*$/i

const stripNoise = (name) => `${name}`.replace(NOISE_SUFFIX, '').trim()

// titre brut en premier (le cas courant), puis nettoyé en repli, seulement si différent
const searchTermVariants = (name) => {
    const cleaned = stripNoise(name)
    return cleaned && cleaned !== name ? [name, cleaned] : [name]
}

const SEARCH_RESULT_LIMIT = 10

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
// délais avant de retenter Deezer après un quota dépassé, croissants : un
// seul retry court suffisait pas (testé : 60 requêtes en même temps, le
// quota est encore dépassé 1.2s après). on préfère patienter plutôt que de
// retomber sur iTunes, moins fiable que Deezer.
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
    // `null` distingue un échec à retenter (réseau, ou quota dépassé, voir
    // plus bas) d'une vraie réponse à zéro résultat : searchDeezerPreview
    // retente que sur le premier cas, pas pour un titre absent du catalogue.
    // Deezer répond en HTTP 200 même en cas de quota dépassé (avec un champ
    // error dans le JSON), donc sans ce check on le prenait pour "zéro
    // résultat légitime" et le retry ne se déclenchait jamais.
    if (!data || data.error) return null
    return data.data || []
}

// retente les requêtes Deezer en échec réseau (fréquent pendant une rafale
// de résolutions en parallèle) avant de basculer sur iTunes : sinon on perd
// la source la plus fiable et le repli iTunes sans artiste peut valider un
// titre homonyme sans rapport (vécu en vrai : "Reel It In" d'Aminé a joué
// l'extrait d'un titre iTunes totalement différent). retente pas quand
// Deezer répond juste zéro résultat, seulement sur échec réseau.
const searchDeezerPreview = async (name, artist) => {
    if (!name && !artist) return null

    // pour chaque variante de titre, deux requêtes en parallèle : la syntaxe
    // à champs de Deezer (artist:"X" track:"Y"), plus précise, et une requête
    // texte libre en complément (le champ échoue parfois sur des caractères spéciaux)
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
        // on attend un peu avant de retenter : le quota Deezer se rouvre sur
        // une fenêtre glissante de quelques secondes, retenter tout de suite
        // tomberait souvent dans la même fenêtre encore pleine
        await sleep(delayMs)
        resultSets = await Promise.all(queries.map(searchDeezerOnce))
    }
    const safeResultSets = resultSets.map((r) => r || [])

    // strict:true veut dire l'artiste a aussi été vérifié (première boucle).
    // ça sert à resolvePreviewUrl pour savoir s'il peut enregistrer le match
    // dans la base permanente (saveVerifiedMatch), jamais pour un repli sans artiste
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
    // dernier recours, sur les mêmes résultats déjà récupérés : titre seul, sans exiger l'artiste
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

// sans le paramètre `country`, iTunes retombe sur le catalogue US par
// défaut, qui n'a pas forcément les mêmes titres (droits différents par
// pays) que le catalogue FR. codé en dur pour l'instant, le public visé est francophone.
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
    // dernier recours, sur les mêmes résultats déjà récupérés : titre seul, sans exiger l'artiste
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

// équivalent iTunes de fetchFreshDeezerPreview : un lookup direct par id,
// une seule requête, sans recherche floue. sert à rafraîchir un match iTunes
// déjà vérifié plutôt que de refaire toute la recherche. revalidé comme
// toute autre source, un id peut lui aussi avoir changé de fiche entre-temps.
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

// dispatcher pour resolvePreviewUrl, qui rafraîchit un match déjà vérifié :
// 1 requête par id, jamais de recherche floue, quel que soit le fournisseur
const fetchFreshByProviderId = async (provider, providerId) => {
    if (provider === 'deezer') return fetchFreshDeezerPreview(providerId)
    if (provider === 'itunes') return fetchFreshItunesPreview(providerId)
    return null
}

// track: { name, artist, previewUrl?, provider?, id? }
export const resolvePreviewUrl = async (track) => {
    // un titre Deezer a toujours un vrai id Deezer, donc on peut récupérer un
    // extrait tout frais directement plutôt que de faire confiance au
    // previewUrl du client (souvent périmé) ou au cache. on valide quand même
    // titre+artiste : un id peut avoir changé de fiche depuis (vécu en vrai,
    // "METAMORPHOSIS - Sped Up" a joué l'extrait d'un titre totalement différent sans ce check).
    if (track.provider === 'deezer' && track.id) {
        const fresh = await fetchFreshDeezerPreview(track.id)
        if (fresh && isRealMatch(track.name, track.artist, fresh.title, fresh.artist)) return fresh.preview
        // si le titre a disparu ou que l'id correspond plus, on continue vers previewUrl/cache/recherche
    }

    if (track.previewUrl) return track.previewUrl

    const key = cacheKey(track.name, track.artist)
    const cached = cache.get(key)
    if (cached && Date.now() - cached.resolvedAt < CACHE_TTL_MS) return cached.url

    // base commune à toutes les parties de correspondances déjà vérifiées :
    // une seule requête par id au lieu des ~4 d'une recherche complète.
    // revalidée comme toute autre source, un id peut avoir changé depuis.
    const verified = await getVerifiedMatch(track.name, track.artist)
    if (verified) {
        const fresh = await fetchFreshByProviderId(verified.provider, verified.providerId)
        if (fresh && isRealMatch(track.name, track.artist, fresh.title, fresh.artist)) {
            cache.set(key, { url: fresh.preview, resolvedAt: Date.now() })
            return fresh.preview
        }
        // entrée périmée : on retombe sur la recherche complète, qui l'écrasera si elle réussit
    }

    const result =
        (await searchDeezerPreview(track.name, track.artist)) ?? (await searchItunesPreview(track.name, track.artist))
    const url = result?.preview ?? null
    // on met en cache que les vrais extraits trouvés : un échec est souvent
    // juste un rate limiting temporaire (rafale de résolutions en parallèle),
    // et retenter plus tard sans la même charge marche souvent. mettre un
    // échec en cache l'aurait gravé 10 min (CACHE_TTL_MS) pour rien.
    if (url) {
        cache.set(key, { url, resolvedAt: Date.now() })
        // n'enregistre en base permanente que les matches stricts, jamais
        // ceux du repli sans artiste, déjà risqués. c'est pas attendu, un
        // souci Mongo doit jamais retarder la manche.
        if (result.strict) {
            saveVerifiedMatch(track.name, track.artist, result.provider, result.providerId, result.title, result.artist)
        }
    }
    return url
}
