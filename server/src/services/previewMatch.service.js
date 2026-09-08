import { PreviewMatchModel } from '../models/previewMatch.model.js'
import { normalizeTrackText } from '../utils/normalizeTrackText.js'

// au-delà de ce nombre de joueurs distincts ayant signalé un mauvais extrait
// sur une même entrée (cf. flagMatch), l'entrée est supprimée : la prochaine
// résolution repart sur une vraie recherche, revalidée (cf.
// preview.service.js). Plus d'un seul signalement pour ne pas laisser un
// unique clic (erreur d'inattention, troll) invalider une entrée par ailleurs
// correcte, sans laisser non plus une entrée réellement mauvaise se rejouer
// indéfiniment dans toutes les parties futures.
const FLAG_INVALIDATE_THRESHOLD = 2

const matchKey = (name, artist) => `${normalizeTrackText(name)}::${normalizeTrackText(artist)}`

// Toutes les fonctions ci-dessous avalent silencieusement les erreurs Mongo
// (retournent null / ne bloquent rien) : cette base est une optimisation qui
// réduit le nombre de requêtes Deezer/iTunes nécessaires dans le temps (cf.
// previewMatch.model.js), jamais une dépendance obligatoire — un hoquet Mongo
// ne doit jamais empêcher une résolution d'extrait de retomber sur la
// recherche live habituelle.

// cf. preview.service.js/resolvePreviewUrl : consultée avant toute recherche
// live, pour retrouver directement l'extrait d'un titre déjà résolu par
// N'IMPORTE QUELLE partie précédente (pas seulement celle-ci)
export const getVerifiedMatch = async (name, artist) => {
    try {
        const doc = await PreviewMatchModel.findOne({ key: matchKey(name, artist) }).lean()
        return doc || null
    } catch (err) {
        console.error('⚠️ getVerifiedMatch (Mongo indisponible ?) :', err.message)
        return null
    }
}

// appelée uniquement après un match STRICT (titre ET artiste vérifiés, cf.
// isRealMatch requireArtist: true dans preview.service.js) — jamais après le
// repli de dernier recours qui ignore l'artiste, pour ne pas graver dans une
// base PARTAGÉE ENTRE TOUTES LES PARTIES un résultat déjà risqué au moment
// même où on le trouve
export const saveVerifiedMatch = async (name, artist, provider, providerId, verifiedTitle, verifiedArtist) => {
    try {
        await PreviewMatchModel.findOneAndUpdate(
            { key: matchKey(name, artist) },
            {
                key: matchKey(name, artist),
                provider,
                providerId: String(providerId),
                verifiedTitle,
                verifiedArtist,
                // une résolution fraîche et à nouveau validée efface l'historique
                // de signalements précédent : soit l'entrée était bonne
                // (signalements dus au hasard/rate limiting d'alors), soit elle
                // vient d'être remplacée par un nouveau match tout aussi vérifié
                flagCount: 0,
                lastFlaggedAt: null,
            },
            { upsert: true }
        )
    } catch (err) {
        console.error('⚠️ saveVerifiedMatch (Mongo indisponible ?) :', err.message)
    }
}

// cf. game:reportWrongPreview (game.sockets.js) : un joueur signale, depuis
// l'écran de résultat, que l'extrait joué ne correspondait pas au titre
// affiché. Renvoie true si l'entrée vient d'être invalidée (utile pour le log
// appelant), false sinon (signalement pris en compte mais sous le seuil, ou
// aucune entrée trouvée pour ce titre).
export const flagMatch = async (name, artist) => {
    try {
        const key = matchKey(name, artist)
        const doc = await PreviewMatchModel.findOneAndUpdate(
            { key },
            { $inc: { flagCount: 1 }, $set: { lastFlaggedAt: new Date() } },
            { new: true }
        )
        if (!doc) return false
        if (doc.flagCount >= FLAG_INVALIDATE_THRESHOLD) {
            await PreviewMatchModel.deleteOne({ key })
            return true
        }
        return false
    } catch (err) {
        console.error('⚠️ flagMatch (Mongo indisponible ?) :', err.message)
        return false
    }
}
