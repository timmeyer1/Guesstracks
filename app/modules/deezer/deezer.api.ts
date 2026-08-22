import { deezerApiClient } from "../../core/api/deezer.client";

// Deezer répond en HTTP 200 même en cas d'échec, avec ce corps d'erreur (cf.
// app/core/api/deezer.client.ts) : présent (optionnellement) sur toutes les
// réponses ci-dessous.
export type DeezerErrorPayload = {
    error?: { type?: string; message?: string; code?: number }
}

export type DeezerUserProfile = DeezerErrorPayload & {
    id: number | string
    name: string
    picture?: string
    picture_medium?: string
}

export type DeezerTrackItem = {
    id: number | string
    title: string
    preview?: string | null
    artist?: { name?: string }
    album?: { title?: string; cover?: string; cover_medium?: string }
}

export type DeezerTracksResponse = DeezerErrorPayload & {
    data?: DeezerTrackItem[]
    total?: number
}

export const deezerApi = {

    // -- connexion OAuth : nécessite un app_id/secret Deezer enregistré sur
    // developers.deezer.com (cf. app/modules/auth/deezer.ts et
    // server/src/routes/auth.routes.js). Dormant tant que la création d'app
    // est indisponible côté Deezer — cf. getPublic* ci-dessous pour le
    // chemin actuellement utilisé par l'écran de connexion.
    getUserProfile: () =>
        deezerApiClient.get<DeezerUserProfile>('/user/me'),

    getUserFavoriteTracks: (limit = 50, index = 0) =>
        deezerApiClient.get<DeezerTracksResponse>('/user/me/tracks', {
            params: {
                limit,
                index,
            }
        }),

    // -- lookup de profil public, sans authentification : Deezer expose
    // /user/{id} et /user/{id}/tracks sans token dès lors que l'utilisateur
    // n'a pas rendu ses titres likés privés
    getPublicProfile: (userId: string) =>
        deezerApiClient.get<DeezerUserProfile>(`/user/${userId}`),

    getPublicFavoriteTracks: (userId: string, limit = 50, index = 0) =>
        deezerApiClient.get<DeezerTracksResponse>(`/user/${userId}/tracks`, {
            params: {
                limit,
                index,
            }
        }),
};
