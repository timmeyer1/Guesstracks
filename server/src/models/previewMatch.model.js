import mongoose from 'mongoose'

// Base globale (partagée par TOUTES les parties, pas par lobby) des
// correspondances titre+artiste -> extrait déjà vérifiées avec succès (cf.
// preview.service.js/getVerifiedMatch). Objectif : au fil du temps, de moins
// en moins de titres nécessitent une vraie recherche Deezer/iTunes (donc de
// moins en moins de requêtes vers ces API publiques à quota limité, cf.
// PREVIEW_PREFETCH_BATCH_SIZE dans game.service.js) puisque la musique
// populaire se concentre sur un nombre limité de titres, likés par des
// joueurs différents dans des parties différentes.
//
// On ne stocke JAMAIS le lien de l'extrait lui-même : les liens Deezer sont
// des URLs signées qui expirent après ~15 min (cf. deezer.service.js), et
// resteraient mortes bien après leur écriture ici. On stocke l'identifiant du
// titre chez le fournisseur (providerId), stable dans le temps, qui permet de
// toujours récupérer un extrait FRAIS en un seul appel (cf.
// fetchFreshByProviderId, preview.service.js) plutôt qu'une recherche floue à
// plusieurs requêtes.
const previewMatchSchema = new mongoose.Schema({
    // normalizeTrackText(name) + '::' + normalizeTrackText(artist), cf.
    // preview.service.js — même normalisation que le reste du fichier, pour
    // que deux graphies différentes du même titre (accents, casse...)
    // retombent sur la même entrée
    key: { type: String, required: true, unique: true, index: true },
    provider: { type: String, enum: ['deezer', 'itunes'], required: true },
    providerId: { type: String, required: true },
    // titre/artiste TELS QUE renvoyés par le fournisseur au moment de la
    // vérification (pas ceux du joueur) : utile pour un diagnostic manuel,
    // jamais utilisé pour la revalidation (cf. isRealMatch, toujours comparé
    // au nom d'origine transmis par le client)
    verifiedTitle: { type: String, required: true },
    verifiedArtist: { type: String, required: true },
    // nombre de joueurs distincts ayant signalé un mauvais extrait sur cette
    // entrée (cf. game:reportWrongPreview) : au-delà du seuil (cf.
    // FLAG_INVALIDATE_THRESHOLD, previewMatch.service.js), l'entrée est
    // supprimée pour forcer une nouvelle recherche revalidée à la prochaine
    // résolution, plutôt que de rejouer indéfiniment un mauvais extrait
    flagCount: { type: Number, default: 0 },
    lastFlaggedAt: { type: Date, default: null },
    createdAt: { type: Date, default: Date.now },
})

export const PreviewMatchModel = mongoose.model('PreviewMatch', previewMatchSchema)
