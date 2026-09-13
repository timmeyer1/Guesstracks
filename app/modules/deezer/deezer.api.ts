import { deezerApiClient } from "../../core/api/deezer.client";

// en gros Deezer renvoie du 200 même quand ça foire, avec ce format
// d'erreur en plus dans la réponse (voir deezer.client.ts)
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

    // connexion via OAuth Deezer : demande un app_id/secret enregistré chez
    // Deezer. Dcp pas utilisé pour l'instant (création d'app fermée côté
    // Deezer) — c'est getPublic* en dessous qui est vraiment utilisé
    getUserProfile: () =>
        deezerApiClient.get<DeezerUserProfile>('/user/me'),

    getUserFavoriteTracks: (limit = 50, index = 0) =>
        deezerApiClient.get<DeezerTracksResponse>('/user/me/tracks', {
            params: {
                limit,
                index,
            }
        }),

    // récupère un profil public, sans se connecter : ça marche tant que
    // l'utilisateur n'a pas mis ses titres likés en privé
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
