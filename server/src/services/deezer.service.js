// Accès à l'endpoint détaillé /track/{id} de Deezer, pour deux besoins qui
// n'existent pas dans la liste des titres likés (cf. app/modules/deezer côté
// client) : la liste complète des artistes (contributors) et un extrait audio
// FRAIS — les deux détails ci-dessous expliquent pourquoi ils sont traités
// différemment côté cache.
const DEEZER_TRACK_URL = 'https://api.deezer.com/track'
const DEEZER_SEARCH_URL = 'https://api.deezer.com/search'
const DEEZER_ALBUM_URL = 'https://api.deezer.com/album'
const DEEZER_ARTIST_URL = 'https://api.deezer.com/artist'

// contributors ne change jamais pour un id donné : mis en cache indéfiniment
const artistCache = new Map() // id de titre Deezer -> artiste enrichi | null

const formatContributors = (contributors) => {
    const names = [...new Set((contributors || []).map((c) => c?.name).filter(Boolean))]
    if (names.length === 0) return null
    if (names.length === 1) return names[0]
    return `${names[0]} feat. ${names.slice(1).join(', ')}`
}

// commun à tous les appels Deezer ci-dessous (détail d'un titre, recherche,
// tracklist d'un album) : `data.error` (cf. searchDeezerOnce dans
// preview.service.js) signale un échec métier (quota dépassé, id invalide...)
// alors même que la requête HTTP a réussi (200) — jamais traité comme un
// succès silencieux ici, faute de quoi un appelant recevrait un objet sans
// les champs attendus.
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

// track: { id, artist, provider }. Renvoie l'artiste enrichi (avec
// featurings) pour un titre Deezer si trouvé, sinon l'artiste déjà connu tel
// quel (y compris pour les titres non-Deezer, laissés inchangés).
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

// Contrairement aux artistes ci-dessus, l'extrait audio de Deezer est une URL
// signée dont le jeton expire environ 15 minutes après avoir été émise
// (constaté empiriquement, non documenté par Deezer — même endpoint /track/
// {id}, même recherche, ou même la liste des titres likés récupérée à la
// connexion : toutes portent cette expiration). La mettre en cache comme les
// artistes la rendrait périmée bien avant que les dernières manches d'une
// partie ne soient jouées, voire dès la partie suivante — d'où l'absence
// totale de cache ici, volontaire : chaque appel renvoie un extrait
// fraîchement valide. À n'appeler qu'au moment de réellement envoyer la
// manche au client (cf. game.service.js), jamais en amont.
//
// Renvoie aussi le titre/artiste Deezer de cet id (pas seulement l'extrait) :
// preview.service.js les compare au titre/artiste attendus avant de faire
// confiance à l'extrait, plutôt que de faire confiance à l'id aveuglément —
// un id soumis par le client peut avoir été réassigné à une autre fiche côté
// Deezer entre-temps (fusion/réédition de catalogue), ce qui renvoyait alors
// l'extrait d'un titre totalement différent sans qu'aucune validation ne
// l'attrape (contrairement à isRealMatch, appliqué à toute autre source).
export const fetchFreshDeezerPreview = async (trackId) => {
    const data = await fetchTrackDetails(trackId)
    if (!data?.preview) return null
    return { preview: data.preview, title: data.title, artist: data.artist?.name }
}

// nombre d'albums distincts détaillés par recherche : chacun coûte un appel
// Deezer supplémentaire (cf. fetchAlbumTracks ci-dessous) — plafonné pour
// qu'une recherche large (ex: un nom d'artiste très courant) ne déclenche pas
// des dizaines de requêtes en parallèle pour une seule frappe utilisateur
const MAX_ALBUMS_PER_SEARCH = 6
// un album studio dépasse rarement ça ; au-delà, la fin de la tracklist est
// tronquée plutôt que de paginer (compilation/discographie complète, cas
// marginal pour cet usage)
const ALBUM_TRACKS_LIMIT = 100

const fetchAlbumTracks = async (albumId) => {
    const url = new URL(`${DEEZER_ALBUM_URL}/${albumId}/tracks`)
    url.searchParams.set('limit', String(ALBUM_TRACKS_LIMIT))
    const data = await fetchJson(url)
    return data?.data || []
}

// au-delà, la discographie complète d'un artiste très prolifique (ex: un
// rappeur qui enchaîne les singles) déclencherait bien trop de requêtes
// tracklist en parallèle (cf. fetchAlbumTracks) pour une seule frappe
// utilisateur — les plus récents d'abord (ordre déjà renvoyé par Deezer),
// donc ceux qui manquent le plus souvent sont aussi les moins pertinents
const MAX_ARTIST_ALBUMS = 20

const fetchArtistAlbums = async (artistId) => {
    const url = new URL(`${DEEZER_ARTIST_URL}/${artistId}/albums`)
    url.searchParams.set('limit', String(MAX_ARTIST_ALBUMS))
    const data = await fetchJson(url)
    return data?.data || []
}

// nombre d'artistes similaires suggérés (cf. app/screens/manualTrackPicker.screen.tsx,
// bandeau du bas) : juste de quoi remplir la bande horizontale, sans alourdir
// l'appel pour rien
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

// insensible à la casse/aux accents, même logique que
// app/components/game/SearchTrackQuestion.tsx (client) — dupliquée ici plutôt
// que partagée, les deux bases de code n'importent pas l'une de l'autre
const DIACRITICS_RANGE = new RegExp('[\\u0300-\\u036f]', 'g')
const normalize = (value) =>
    `${value ?? ''}`
        .normalize('NFD')
        .replace(DIACRITICS_RANGE, '')
        .toLowerCase()
        .trim()

// commun aux deux stratégies de recherche ci-dessous : résout la tracklist
// complète de chaque album repéré, dans son ordre officiel
const buildAlbumsWithTracks = async (albumEntries) => {
    const albums = await Promise.all(
        albumEntries.map(async (album) => {
            const rawTracks = await fetchAlbumTracks(album.id)
            const tracks = rawTracks
                // ordre officiel de l'album (déjà l'ordre renvoyé par Deezer en
                // pratique) : trié explicitement au cas où, un album multi-disques
                // n'étant pas garanti dans cet ordre par l'API
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

    // un album dont la tracklist n'a pas pu être récupérée (échec réseau
    // isolé, cf. fetchJson) n'a aucun intérêt à apparaître vide
    return albums.filter((album) => album.tracks.length > 0)
}

// repère l'artiste que la requête désigne, parmi les résultats d'une
// recherche de titres classique : PAS forcément l'artiste du tout premier
// résultat, dont le titre le mieux classé peut être un featuring où
// l'artiste principal est un tiers (constaté en pratique : chercher "daft
// punk" fait remonter en tête "Starboy" - The Weeknd ft. Daft Punk, pas un
// titre de Daft Punk lui-même). On scanne donc tous les résultats à la
// recherche d'une correspondance EXACTE en priorité, avant de retomber sur
// une correspondance floue (préfixe) limitée au tout premier résultat —
// au-delà, trop de faux positifs sur une requête qui ne désigne pas un
// artiste précis (ex: un titre de chanson).
//
// Seul le sens "l'artiste du top résultat commence par la requête" est
// gardé ici (ex: requête tronquée/typo "daft" -> artiste "Daft Punk"). Le
// sens inverse ("la requête commence par le nom de l'artiste") a été retiré :
// il matchait aussi n'importe quelle requête tapée "Artiste Titre" (l'ordre
// naturel pour chercher un titre précis), dès que Deezer classait un titre
// de cet artiste en tête — ex: "gambi loco loco" matchait l'artiste "Gambi"
// (préfixe de la requête) et faisait alors lister toute sa discographie par
// date au lieu du titre "Loco Loco" recherché (constaté en pratique : rien
// ne remontait, et un album sans rapport s'affichait en premier), alors que
// "loco loco gambi" — même recherche, mots inversés — fonctionnait très bien.
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

// Recherche groupée par album pour la "connexion universelle" (choix manuel
// des titres, cf. app/screens/manualTrackPicker.screen.tsx) : la recherche
// Deezer classique renvoie des titres épars dans un ordre de pertinence qui
// mélange les albums, peu lisible pour composer sa bibliothèque. Deux
// stratégies selon ce que la requête semble désigner :
//
// - un ARTISTE (la requête correspond au nom de l'artiste du meilleur
//   résultat) : sa discographie COMPLÈTE est récupérée via /artist/{id}/albums
//   plutôt que déduite des résultats de recherche — une recherche de titres
//   classique ne remonte que les morceaux les plus populaires de cet artiste
//   (triés par `rank`), donc souvent seulement une poignée de ses albums,
//   jamais l'intégralité (constaté en pratique sur un artiste aux nombreux
//   singles : sur ~40 sorties, à peine 2-3 remontaient via la recherche de
//   titres). L'id artiste vient du MEILLEUR résultat de la recherche de
//   titres ci-dessous plutôt que de /search/artist : ce dernier renvoie
//   parfois plusieurs fiches homonymes distinctes pour un même nom (constaté
//   en pratique, doublons Deezer) sans indication de laquelle est la
//   "vraie"/active, alors que l'artiste le mieux classé sur une recherche de
//   titres est fiable par construction (c'est lui dont les titres sont
//   effectivement populaires).
// - un TITRE ou un artiste secondaire (featuring...) : repli sur les albums
//   distincts trouvés parmi les résultats de la recherche, dans leur ordre de
//   pertinence Deezer — l'ancien comportement, toujours pertinent pour une
//   requête qui ne désigne pas un artiste précis.
//
// Dans les deux cas, la tracklist COMPLÈTE de chaque album est ensuite
// récupérée séparément (cf. buildAlbumsWithTracks), dans l'ordre officiel de
// l'album — pas seulement les titres qui ont matché la requête initiale.
//
// En plus des albums : une poignée d'artistes similaires à l'artiste du tout
// premier résultat (cf. fetchRelatedArtists) — qu'il s'agisse d'une recherche
// d'artiste ("gambi") ou de titre ("promenade (de la rvffleuse)"), c'est
// toujours lui le plus représentatif de la requête tapée. Un seul appel
// Deezer de plus, lancé EN PARALLÈLE de buildAlbumsWithTracks (déjà le plus
// long des deux) : n'ajoute donc aucune latence perceptible.
//
// Catalogue Deezer appelé depuis le serveur, jamais depuis le navigateur, car
// api.deezer.com ne renvoie aucun header CORS (constaté en pratique —
// contrairement au lookup de profil public, appelé lui directement depuis le
// client, cf. app/modules/deezer/deezer.api.ts, qui ne fonctionne donc qu'en
// natif). Pas de validation stricte titre/artiste façon
// preview.service.js/isRealMatch : ici c'est le joueur lui-même qui choisit
// dans une liste, pas un matching automatique à sécuriser.
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
        const rawAlbums = await fetchArtistAlbums(matchedArtist.id)
        const albumEntries = rawAlbums.map((album) => ({
            id: String(album.id),
            title: album.title,
            artist: matchedArtist.name,
            cover: album.cover_medium ?? album.cover ?? null,
        }))
        const [albums, similarArtists] = await Promise.all([buildAlbumsWithTracks(albumEntries), similarArtistsPromise])
        return { albums, similarArtists }
    }

    // dédoublonne par album, en gardant l'ordre d'apparition (= pertinence
    // Deezer pour cette requête)
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

    const [albums, similarArtists] = await Promise.all([
        buildAlbumsWithTracks([...albumsById.values()]),
        similarArtistsPromise,
    ])
    return { albums, similarArtists }
}
