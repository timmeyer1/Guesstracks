export const API_TIMEOUT = 10000;

export const SPOTIFY_BASE_URL = 'https://api.spotify.com/v1';
export const DEEZER_BASE_URL = 'https://api.deezer.com';
export const APPLE_MUSIC_BASE_URL = 'https://api.music.apple.com/v1';

// Serveur de lobby (créer/rejoindre une partie). Sur un appareil physique,
// remplace "localhost" par l'IP locale de la machine qui héberge le serveur.
export const LOBBY_SERVER_URL = process.env.EXPO_PUBLIC_LOBBY_SERVER_URL || 'http://localhost:4000';

// Le jeton de lobby (Authorization header, cf. app/core/api/lobby.client.ts)
// et tous les événements de partie (cf. app/core/socket.ts) transitent par
// cette URL : garde-fou pour ne jamais expédier un build de production avec
// une URL encore en clair (http/ws), qui exposerait token et état de partie
// à n'importe quelle interception réseau (cf. audit sécurité, finding I5).
if (!__DEV__ && !LOBBY_SERVER_URL.startsWith('https://')) {
    throw new Error(
        'EXPO_PUBLIC_LOBBY_SERVER_URL doit être en https:// pour un build de production ' +
        '(le token de lobby et les événements de partie transiteraient sinon en clair).'
    );
}
