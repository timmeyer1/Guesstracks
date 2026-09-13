export const API_TIMEOUT = 10000;

export const SPOTIFY_BASE_URL = 'https://api.spotify.com/v1';
export const DEEZER_BASE_URL = 'https://api.deezer.com';
export const APPLE_MUSIC_BASE_URL = 'https://api.music.apple.com/v1';

// Serveur de lobby (créer/rejoindre une partie). Sur un vrai téléphone, remplace "localhost" par l'IP locale du serveur.
export const LOBBY_SERVER_URL = process.env.EXPO_PUBLIC_LOBBY_SERVER_URL || 'http://localhost:4000';

// En gros ce garde-fou empêche de sortir un build de prod avec une URL en
// clair (http/ws), sinon le jeton et l'état de partie seraient lisibles par n'importe qui sur le réseau.
if (!__DEV__ && !LOBBY_SERVER_URL.startsWith('https://')) {
    throw new Error(
        'EXPO_PUBLIC_LOBBY_SERVER_URL doit être en https:// pour un build de production ' +
        '(le token de lobby et les événements de partie transiteraient sinon en clair).'
    );
}
