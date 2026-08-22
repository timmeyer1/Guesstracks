import { deezerApiClient } from "../../core/api/deezer.client";

export const deezerApi = {

    // -- connexion OAuth : nécessite un app_id/secret Deezer enregistré sur
    // developers.deezer.com (cf. app/modules/auth/deezer.ts et
    // server/src/routes/auth.routes.js). Dormant tant que la création d'app
    // est indisponible côté Deezer — cf. getPublic* ci-dessous pour le
    // chemin actuellement utilisé par l'écran de connexion.
    getUserProfile: () =>
        deezerApiClient.get('/user/me'),

    getUserFavoriteTracks: (limit = 50, index = 0) =>
        deezerApiClient.get('/user/me/tracks', {
            params: {
                limit,
                index,
            }
        }),

    // -- lookup de profil public, sans authentification : Deezer expose
    // /user/{id} et /user/{id}/tracks sans token dès lors que l'utilisateur
    // n'a pas rendu ses titres likés privés
    getPublicProfile: (userId: string) =>
        deezerApiClient.get(`/user/${userId}`),

    getPublicFavoriteTracks: (userId: string, limit = 50, index = 0) =>
        deezerApiClient.get(`/user/${userId}/tracks`, {
            params: {
                limit,
                index,
            }
        }),
};
