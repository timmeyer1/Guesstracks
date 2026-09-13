// accès à l'endpoint détaillé /track/{id} de Deezer, pour deux trucs qui
// manquent dans la liste des titres likés (côté client) : tous les artistes
// (contributors) et un extrait audio frais. les deux sont mis en cache différemment, voir plus bas pourquoi.
const DEEZER_TRACK_URL = 'https://api.deezer.com/track'
const DEEZER_SEARCH_URL = 'https://api.deezer.com/search'
const DEEZER_ALBUM_URL = 'https://api.deezer.com/album'
const DEEZER_ARTIST_URL = 'https://api.deezer.com/artist'

// contributors change jamais pour un id donné, donc mis en cache pour toujours
const artistCache = new Map() // id de titre Deezer -> artiste enrichi | null

const formatContributors = (contributors) => {
    const names = [...new Set((contributors || []).map((c) => c?.name).filter(Boolean))]
    if (names.length === 0) return null
    if (names.length === 1) return names[0]
    return `${names[0]} feat. ${names.slice(1).join(', ')}`
}

// commun à tous les appels Deezer (détail titre, recherche, tracklist album).
// `data.error` veut dire un échec côté Deezer (quota, id invalide...) même si
// la requête HTTP a réussi. on le traite pas comme un succès, sinon l'appelant
// recevrait un objet vide sans les champs attendus.
const fetchJson = async (url) => {
    try {
        const controller = new AbortController()
        const timeout = setTimeout(() => controller.abort(), 5000)
        const res = await fetch(url, { signal: controller.signal })
        clearTimeout(timeout)

        if (!res.ok) return null
        const data = await res.json()
        if (data.error) return null
        return data
    } catch {
        return null
    }
}

const fetchTrackDetails = (trackId) => fetchJson(`${DEEZER_TRACK_URL}/${trackId}`)

// track: { id, artist, provider }. renvoie l'artiste avec les featurings pour
// un titre Deezer si trouvé, sinon l'artiste déjà connu tel quel (les titres
// non-Deezer sont laissés inchangés)
export const resolveDeezerArtist = async (track) => {
    if (track.provider !== 'deezer') return track.artist

    if (artistCache.has(track.id)) {
        return artistCache.get(track.id) ?? track.artist
    }

    const data = await fetchTrackDetails(track.id)
    const enriched = data ? formatContributors(data.contributors) : null
    artistCache.set(track.id, enriched)
    return enriched ?? track.artist
}

// contrairement aux artistes, l'extrait audio Deezer est une URL signée qui
// expire environ 15 minutes après (constaté nous-mêmes, Deezer le documente
// pas). la mettre en cache la rendrait morte avant la fin de la partie, dcp
// pas de cache ici, exprès : chaque appel renvoie un extrait tout frais.
// à appeler seulement au moment d'envoyer la manche au client (game.service.js), jamais avant.
//
// renvoie aussi le titre/artiste Deezer de cet id, pas juste l'extrait :
// preview.service.js les compare à ce qu'on attendait avant de faire confiance
// à l'extrait. un id client peut avoir été réassigné à une autre fiche côté
// Deezer entre-temps (réédition de catalogue), donc sans ce check on pourrait
// renvoyer l'extrait d'un titre complètement différent.
export const fetchFreshDeezerPreview = async (trackId) => {
    const data = await fetchTrackDetails(trackId)
    if (!data?.preview) return null
    return { preview: data.preview, title: data.title, artist: data.artist?.name }
}

// combien d'albums max on détaille par recherche : chaque album coûte un
// appel Deezer en plus (voir fetchAlbumTracks). ça évite qu'une recherche
// large (nom d'artiste courant) parte sur des dizaines de requêtes en parallèle
const MAX_ALBUMS_PER_SEARCH = 6
// un album studio dépasse rarement ça. au-delà, la tracklist est juste
// tronquée plutôt que paginée (cas marginal genre discographie complète)
const ALBUM_TRACKS_LIMIT = 100

const fetchAlbumTracks = async (albumId) => {
    const url = new URL(`${DEEZER_ALBUM_URL}/${albumId}/tracks`)
    url.searchParams.set('limit', String(ALBUM_TRACKS_LIMIT))
    const data = await fetchJson(url)
    return data?.data || []
}

// au-delà, un artiste très prolifique (plein de singles) déclencherait trop
// de requêtes tracklist en parallèle. Deezer renvoie déjà les plus récents
// d'abord, donc ce qu'on coupe est aussi le moins pertinent
const MAX_ARTIST_ALBUMS = 20

const fetchArtistAlbums = async (artistId) => {
    const url = new URL(`${DEEZER_ARTIST_URL}/${artistId}/albums`)
    url.searchParams.set('limit', String(MAX_ARTIST_ALBUMS))
    const data = await fetchJson(url)
    return data?.data || []
}

// nombre d'artistes similaires suggérés (bandeau du bas dans manualTrackPicker.screen.tsx),
// juste ce qu'il faut pour remplir la bande sans surcharger l'appel
const RELATED_ARTISTS_LIMIT = 10

const fetchRelatedArtists = async (artistId) => {
    const url = new URL(`${DEEZER_ARTIST_URL}/${artistId}/related`)
    url.searchParams.set('limit', String(RELATED_ARTISTS_LIMIT))
    const data = await fetchJson(url)
    return (data?.data || []).map((a) => ({
        id: String(a.id),
        name: a.name,
        picture: a.picture_medium ?? a.picture ?? null,
    }))
}

// ignore casse/accents, même logique que SearchTrackQuestion.tsx côté client
// — dupliquée ici, le serveur et le client n'importent pas l'un de l'autre
const DIACRITICS_RANGE = new RegExp('[\\u0300-\\u036f]', 'g')
const normalize = (value) =>
    `${value ?? ''}`
        .normalize('NFD')
        .replace(DIACRITICS_RANGE, '')
        .toLowerCase()
        .trim()

// Deezer liste parfois deux albums (ids différents) pour un même titre : une
// réédition/deluxe à côté de l'original (ex vu en vrai : "Polak" de PLK sort
// deux fois, la deuxième avec des titres bonus). `key` peut inclure l'artiste
// pour éviter de fusionner par erreur deux albums same-titre d'artistes
// différents. entre deux doublons, on garde le plus récent (une réédition
// est toujours plus complète que l'original), sinon le premier trouvé.
const dedupeAlbumsByTitle = (albums, { key = (a) => normalize(a.title) } = {}) => {
    const byKey = new Map()
    for (const album of albums) {
        const k = key(album)
        const existing = byKey.get(k)
        const bothDated = album.release_date && existing?.release_date
        if (!existing || (bothDated && `${album.release_date}` > `${existing.release_date}`)) {
            byKey.set(k, album)
        }
    }
    return [...byKey.values()]
}

// commun aux deux stratégies de recherche ci-dessous : résout la tracklist
// complète de chaque album repéré, dans son ordre officiel
const buildAlbumsWithTracks = async (albumEntries) => {
    const albums = await Promise.all(
        albumEntries.map(async (album) => {
            const rawTracks = await fetchAlbumTracks(album.id)
            const tracks = rawTracks
                // Deezer renvoie déjà dans l'ordre officiel, mais on trie quand
                // même : un album multi-disques n'est pas garanti dans cet ordre
                .slice()
                .sort((a, b) => (a.disk_number - b.disk_number) || (a.track_position - b.track_position))
                .map((t) => ({
                    id: String(t.id),
                    name: t.title,
                    artist: t.artist?.name ?? album.artist,
                    album: album.title,
                    image: album.cover,
                    previewUrl: t.preview || null,
                }))
            return { ...album, tracks }
        })
    )

    // pas la peine d'afficher un album vide parce que sa tracklist a foiré
    return albums.filter((album) => album.tracks.length > 0)
}

// trouve l'artiste désigné par la requête, pas forcément celui du premier
// résultat ("daft punk" remonte "Starboy" - The Weeknd ft. Daft Punk en tête).
// on cherche une correspondance exacte, sinon un préfixe mais seulement sur
// le tout premier résultat (sinon trop de faux positifs). on teste juste
// "l'artiste top commence par la requête" (typo "daft" -> "Daft Punk"), pas
// l'inverse : ça matchait "Gambi" dans "gambi loco loco" et cachait le vrai titre cherché.
const findMatchingArtist = (items, normalizedQuery) => {
    for (const item of items) {
        if (item.artist && normalize(item.artist.name) === normalizedQuery) return item.artist
    }

    const topArtist = items[0]?.artist
    if (topArtist) {
        const normalizedTopArtist = normalize(topArtist.name)
        if (normalizedTopArtist.startsWith(normalizedQuery)) {
            return topArtist
        }
    }

    return null
}

// recherche groupée par album pour la connexion universelle (choix manuel des
// titres, voir manualTrackPicker.screen.tsx) : la recherche Deezer classique
// mélange les albums dans son ordre de pertinence, illisible pour se
// constituer une bibliothèque. si la requête désigne un artiste, on récupère
// toute sa discographie via /artist/{id}/albums (la recherche de titres ne
// remonte que ses morceaux les plus populaires, jamais tout). sinon, repli
// sur les albums trouvés dans les résultats de recherche. dans les deux cas
// on va chercher la tracklist complète de chaque album ensuite (voir
// buildAlbumsWithTracks), plus une poignée d'artistes similaires en bonus.
// appelé depuis le serveur, pas le navigateur, car l'API Deezer bloque le
// CORS. pas de validation stricte titre/artiste ici : c'est le joueur qui
// choisit lui-même dans une liste, pas un matching automatique à sécuriser.
export const searchTracksGroupedByAlbum = async (query) => {
    const trimmed = `${query ?? ''}`.trim()
    if (!trimmed) return { albums: [], similarArtists: [] }

    const searchUrl = new URL(DEEZER_SEARCH_URL)
    searchUrl.searchParams.set('q', trimmed)
    searchUrl.searchParams.set('limit', '25')
    const searchData = await fetchJson(searchUrl)
    const items = searchData?.data || []

    const normalizedQuery = normalize(trimmed)
    const matchedArtist = findMatchingArtist(items, normalizedQuery)
    const topArtist = items[0]?.artist ?? null
    const similarArtistsPromise = topArtist ? fetchRelatedArtists(topArtist.id) : Promise.resolve([])

    if (matchedArtist) {
        const rawAlbums = dedupeAlbumsByTitle(await fetchArtistAlbums(matchedArtist.id))
        const albumEntries = rawAlbums.map((album) => ({
            id: String(album.id),
            title: album.title,
            artist: matchedArtist.name,
            cover: album.cover_medium ?? album.cover ?? null,
        }))
        const [albums, similarArtists] = await Promise.all([buildAlbumsWithTracks(albumEntries), similarArtistsPromise])
        return { albums, similarArtists }
    }

    // dédoublonne par id d'abord (en gardant l'ordre de pertinence Deezer),
    // puis par titre+artiste (voir dedupeAlbumsByTitle) : deux ids différents
    // peuvent quand même désigner le même titre chez le même artiste (réédition à part)
    const albumsById = new Map()
    for (const item of items) {
        const albumId = item.album?.id
        if (!albumId || albumsById.has(albumId)) continue
        albumsById.set(albumId, {
            id: String(albumId),
            title: item.album.title,
            artist: item.artist?.name ?? 'Unknown',
            cover: item.album.cover_medium ?? item.album.cover ?? null,
        })
        if (albumsById.size >= MAX_ALBUMS_PER_SEARCH) break
    }
    const dedupedAlbumEntries = dedupeAlbumsByTitle([...albumsById.values()], {
        key: (a) => `${normalize(a.artist)}::${normalize(a.title)}`,
    })

    const [albums, similarArtists] = await Promise.all([
        buildAlbumsWithTracks(dedupedAlbumEntries),
        similarArtistsPromise,
    ])
    return { albums, similarArtists }
}
