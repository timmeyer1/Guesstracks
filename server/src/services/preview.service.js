// Résout un extrait audio de 30s pour une musique.
//
// On n'héberge et ne proxy jamais de contenu Spotify/Deezer nous-mêmes : si le
// client a transmis le previewUrl que Spotify a lui-même renvoyé dans sa
// réponse (souvent absent depuis le durcissement de l'API fin 2024), on le
// garde tel quel. Sinon on retombe sur l'iTunes Search API : un service
// public d'Apple, sans authentification, explicitement prévu pour fournir des
// extraits de 30s — donc pas de risque de dépasser les conditions d'usage de
// Spotify ou Deezer. Si rien n'est trouvé, la manche se joue sans audio.
const ITUNES_SEARCH_URL = 'https://itunes.apple.com/search'

const cache = new Map() // clé "titre::artiste" -> previewUrl | null

const cacheKey = (name, artist) => `${name}`.trim().toLowerCase() + '::' + `${artist}`.trim().toLowerCase()

const DIACRITICS_RANGE = new RegExp('[\\u0300-\\u036f]', 'g')
const normalize = (value) =>
    `${value}`
        .normalize('NFD')
        .replace(DIACRITICS_RANGE, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, ' ')
        .trim()

// iTunes fait de la recherche floue et renvoie parfois un titre totalement
// différent en première position (ex: "Fever" - Buckshot -> "A Fever
// Guttering in the Ribs" - DEAD EYES BASTARD) : on ne fait confiance à un
// résultat que si son titre ET son artiste correspondent réellement, sinon
// on préfère ne pas avoir d'extrait plutôt qu'un mauvais extrait
const isRealMatch = (name, artist, candidate) => {
    const wantedName = normalize(name)
    const wantedArtist = normalize(artist)
    const gotName = normalize(candidate.trackName || '')
    const gotArtist = normalize(candidate.artistName || '')

    if (!gotName || !wantedName) return false
    const nameMatches = gotName === wantedName || gotName.includes(wantedName) || wantedName.includes(gotName)
    if (!nameMatches) return false

    if (!wantedArtist) return true
    return gotArtist.includes(wantedArtist) || wantedArtist.includes(gotArtist)
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
        const match = (data.results || []).find((candidate) => isRealMatch(name, artist, candidate))
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

    const url = await searchItunesPreview(track.name, track.artist)
    cache.set(key, url)
    return url
}
