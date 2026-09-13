import mongoose from 'mongoose'

// dcp c'est une base commune à toutes les parties (pas par lobby) des
// couples titre+artiste déjà vérifiés avec un vrai extrait (voir getVerifiedMatch
// dans preview.service.js). le but : plus le temps passe, moins on a besoin
// de refaire une recherche Deezer/iTunes, parce que la musique populaire
// revient souvent entre les parties (et ces API ont un quota limité).
//
// on stocke jamais le lien de l'extrait lui-même : les liens Deezer expirent
// après ~15 min (voir deezer.service.js). on garde juste l'id du titre chez le
// fournisseur (providerId), qui lui ne change pas, pour retrouver un extrait
// frais en un seul appel plutôt qu'une recherche floue.
const previewMatchSchema = new mongoose.Schema({
    // normalizeTrackText(name) + '::' + normalizeTrackText(artist) (voir
    // preview.service.js) — même normalisation partout, pour que deux
    // écritures différentes du même titre tombent sur la même entrée
    key: { type: String, required: true, unique: true, index: true },
    provider: { type: String, enum: ['deezer', 'itunes'], required: true },
    providerId: { type: String, required: true },
    // titre/artiste renvoyés par le fournisseur, pas ceux tapés par le joueur.
    // sert juste pour vérifier à l'œil, jamais utilisé pour revalider (voir isRealMatch)
    verifiedTitle: { type: String, required: true },
    verifiedArtist: { type: String, required: true },
    // combien de joueurs différents ont signalé un mauvais extrait ici (voir
    // game:reportWrongPreview). au-delà du seuil (FLAG_INVALIDATE_THRESHOLD
    // dans previewMatch.service.js), l'entrée est supprimée pour forcer une
    // nouvelle recherche plutôt que de rejouer le mauvais extrait en boucle
    flagCount: { type: Number, default: 0 },
    lastFlaggedAt: { type: Date, default: null },
    createdAt: { type: Date, default: Date.now },
})

export const PreviewMatchModel = mongoose.model('PreviewMatch', previewMatchSchema)
