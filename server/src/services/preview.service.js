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
const DEEZER_SEARCH_URL = 'https://api.deezer.com/search'
const ITUNES_SEARCH_URL = 'https://itunes.apple.com/search'

const cache = new Map() // clé "titre::artiste" -> previewUrl | null

const cacheKey = (name, artist) => `${name}`.trim().toLowerCase() + '::' + `${artist}`.trim().toLowerCase()

const DIACRITICS_RANGE = new RegExp('[\\u0300-\\u036f]', 'g')
// exportée pour game.service.js : sert aussi à regrouper les titres du pool
// par identité (nom + artiste) plutôt que par id fournisseur (cf. buildPool)
export const normalizeTrackText = (value) =>
    `${value}`
        .normalize('NFD')
        .replace(DIACRITICS_RANGE, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, ' ')
        .trim()

const normalize = normalizeTrackText

// iTunes et Deezer font tous les deux de la recherche floue et renvoient
// parfois un titre totalement différent en première position (ex: "Fever" -
// Buckshot -> "A Fever Guttering in the Ribs" - DEAD EYES BASTARD) : on ne
// fait confiance à un résultat que si son titre ET son artiste correspondent
// réellement, sinon on préfère ne pas avoir d'extrait plutôt qu'un mauvais
// extrait
const isRealMatch = (name, artist, gotName, gotArtist) => {
    const wantedName = normalize(name)
    const wantedArtist = normalize(artist)
    const normGotName = normalize(gotName || '')
    const normGotArtist = normalize(gotArtist || '')

    if (!normGotName || !wantedName) return false
    const nameMatches =
        normGotName === wantedName || normGotName.includes(wantedName) || wantedName.includes(normGotName)
    if (!nameMatches) return false

    if (!wantedArtist) return true
    return normGotArtist.includes(wantedArtist) || wantedArtist.includes(normGotArtist)
}

const searchDeezerPreview = async (name, artist) => {
    const term = `${name} ${artist}`.trim()
    if (!term) return null

    const url = new URL(DEEZER_SEARCH_URL)
    url.searchParams.set('q', term)
    url.searchParams.set('limit', '5')

    try {
        const controller = new AbortController()
        const timeout = setTimeout(() => controller.abort(), 5000)
        const res = await fetch(url, { signal: controller.signal })
        clearTimeout(timeout)

        if (!res.ok) return null
        const data = await res.json()
        const match = (data.data || []).find((candidate) =>
            isRealMatch(name, artist, candidate.title, candidate.artist?.name)
        )
        return match?.preview || null
    } catch {
        return null
    }
}

const searchItunesPreview = async (name, artist) => {
    const term = `${name} ${artist}`.trim()
    if (!term) return null

    const url = new URL(ITUNES_SEARCH_URL)
    url.searchParams.set('term', term)
    url.searchParams.set('entity', 'song')
    url.searchParams.set('limit', '5')

    try {
        const controller = new AbortController()
        const timeout = setTimeout(() => controller.abort(), 5000)
        const res = await fetch(url, { signal: controller.signal })
        clearTimeout(timeout)

        if (!res.ok) return null
        const data = await res.json()
        const match = (data.results || []).find((candidate) =>
            isRealMatch(name, artist, candidate.trackName, candidate.artistName)
        )
        return match?.previewUrl ?? null
    } catch {
        return null
    }
}

// track: { name, artist, previewUrl? }
export const resolvePreviewUrl = async (track) => {
    if (track.previewUrl) return track.previewUrl

    const key = cacheKey(track.name, track.artist)
    if (cache.has(key)) return cache.get(key)

    const url =
        (await searchDeezerPreview(track.name, track.artist)) ?? (await searchItunesPreview(track.name, track.artist))
    cache.set(key, url)
    return url
}
