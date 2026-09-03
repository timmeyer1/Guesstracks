// Accès à l'endpoint détaillé /track/{id} de Deezer, pour deux besoins qui
// n'existent pas dans la liste des titres likés (cf. app/modules/deezer côté
// client) : la liste complète des artistes (contributors) et un extrait audio
// FRAIS — les deux détails ci-dessous expliquent pourquoi ils sont traités
// différemment côté cache.
const DEEZER_TRACK_URL = 'https://api.deezer.com/track'

// contributors ne change jamais pour un id donné : mis en cache indéfiniment
const artistCache = new Map() // id de titre Deezer -> artiste enrichi | null

const formatContributors = (contributors) => {
    const names = [...new Set((contributors || []).map((c) => c?.name).filter(Boolean))]
    if (names.length === 0) return null
    if (names.length === 1) return names[0]
    return `${names[0]} feat. ${names.slice(1).join(', ')}`
}

const fetchTrackDetails = async (trackId) => {
    try {
        const controller = new AbortController()
        const timeout = setTimeout(() => controller.abort(), 5000)
        const res = await fetch(`${DEEZER_TRACK_URL}/${trackId}`, { signal: controller.signal })
        clearTimeout(timeout)

        if (!res.ok) return null
        const data = await res.json()
        if (data.error) return null
        return data
    } catch {
        return null
    }
}

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
