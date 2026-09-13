// nettoie un titre/artiste pour pouvoir comparer des morceaux entre eux
// (on ignore accents, majuscules et ponctuation), plutôt que se fier à l'id
// fournisseur. utilisé dans preview.service.js (isRealMatch), game.service.js
// (poolKey) et previewMatch.service.js. c'est ici et pas ailleurs pour éviter
// un import circulaire entre ces fichiers qui en ont tous besoin.
const DIACRITICS_RANGE = new RegExp('[\\u0300-\\u036f]', 'g')

export const normalizeTrackText = (value) =>
    `${value}`
        .normalize('NFD')
        .replace(DIACRITICS_RANGE, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, ' ')
        .trim()
