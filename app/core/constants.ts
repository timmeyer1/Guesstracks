export const API_TIMEOUT = 10000;

export const SPOTIFY_BASE_URL = 'https://api.spotify.com/v1';
export const DEEZER_BASE_URL = 'https://api.deezer.com';
export const APPLE_MUSIC_BASE_URL = 'https://api.music.apple.com/v1';

// Serveur de lobby (créer/rejoindre une partie). Sur un appareil physique,
// remplace "localhost" par l'IP locale de la machine qui héberge le serveur.
export const LOBBY_SERVER_URL = process.env.EXPO_PUBLIC_LOBBY_SERVER_URL || 'http://localhost:4000';
