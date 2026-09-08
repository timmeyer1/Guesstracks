// Normalisation d'un titre/artiste utilisée pour comparer/regrouper des
// morceaux par identité plutôt que par id fournisseur (accents, casse et
// ponctuation ignorés). Utilisée par preview.service.js (validation des
// résultats de recherche, cf. isRealMatch), game.service.js (regroupement du
// pool, cf. poolKey) et previewMatch.service.js (clé de la base de
// correspondances vérifiées) — extraite ici pour que ces deux derniers
// puissent tous les deux en dépendre sans import circulaire entre eux.
const DIACRITICS_RANGE = new RegExp('[\\u0300-\\u036f]', 'g')

export const normalizeTrackText = (value) =>
    `${value}`
        .normalize('NFD')
        .replace(DIACRITICS_RANGE, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, ' ')
        .trim()
