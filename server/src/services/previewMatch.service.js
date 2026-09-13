import { PreviewMatchModel } from '../models/previewMatch.model.js'
import { normalizeTrackText } from '../utils/normalizeTrackText.js'

// au-delà de ce nombre de joueurs qui signalent un mauvais extrait (voir
// flagMatch), l'entrée est supprimée et la prochaine recherche repart de zéro.
// plus d'un seul signalement, sinon un clic isolé (erreur ou troll) suffirait
// à invalider une entrée correcte — mais pas trop non plus, pour pas laisser
// un vrai mauvais extrait se rejouer indéfiniment dans les parties suivantes
const FLAG_INVALIDATE_THRESHOLD = 2

const matchKey = (name, artist) => `${normalizeTrackText(name)}::${normalizeTrackText(artist)}`

// toutes les fonctions ici avalent les erreurs Mongo en silence (renvoient
// null, bloquent rien) : cette base est juste une optimisation pour moins
// solliciter Deezer/iTunes (voir previewMatch.model.js), jamais un truc
// obligatoire. un souci Mongo doit jamais empêcher de retomber sur la recherche live normale.

// appelée par resolvePreviewUrl (preview.service.js) avant toute recherche
// live, pour retrouver direct l'extrait d'un titre déjà résolu par une partie précédente
export const getVerifiedMatch = async (name, artist) => {
    try {
        const doc = await PreviewMatchModel.findOne({ key: matchKey(name, artist) }).lean()
        return doc || null
    } catch (err) {
        console.error('⚠️ getVerifiedMatch (Mongo indisponible ?) :', err.message)
        return null
    }
}

// appelée seulement après un match strict (titre ET artiste vérifiés, voir
// isRealMatch requireArtist:true dans preview.service.js), jamais après le
// repli qui ignore l'artiste — on veut pas graver un résultat déjà risqué
// dans une base partagée par toutes les parties
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
                // une nouvelle résolution validée efface les anciens signalements :
                // soit l'entrée était bonne, soit elle vient d'être remplacée
                flagCount: 0,
                lastFlaggedAt: null,
            },
            { upsert: true }
        )
    } catch (err) {
        console.error('⚠️ saveVerifiedMatch (Mongo indisponible ?) :', err.message)
    }
}

// appelée par game:reportWrongPreview (game.sockets.js) quand un joueur
// signale un extrait qui colle pas au titre. renvoie true si l'entrée vient
// d'être supprimée, false si c'est sous le seuil ou introuvable
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
