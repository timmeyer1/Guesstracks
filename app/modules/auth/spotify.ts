import * as WebBrowser from 'expo-web-browser';
import * as AuthSession from 'expo-auth-session';

WebBrowser.maybeCompleteAuthSession();

const CLIENT_ID = process.env.EXPO_PUBLIC_SPOTIFY_CLIENT_ID!;
// Calcule automatiquement la bonne URI (host:port réel du serveur Expo en dev,
// scheme "guesstracks://" en build standalone) : un "localhost" codé en dur
// ne fonctionne pas sur un appareil physique, qui a son propre localhost.
const REDIRECT_URI = AuthSession.makeRedirectUri({ scheme: 'guesstracks' });

const discovery = {
    authorizationEndpoint: 'https://accounts.spotify.com/authorize',
    tokenEndpoint: 'https://accounts.spotify.com/api/token',
};

export const loginWithSpotify = async () => {
    console.log('--------------------------------------------------------------------------');
    console.log('redirect URI (à whitelister dans le dashboard Spotify) :', REDIRECT_URI);

    const request = await AuthSession.loadAsync(
        {
            clientId: CLIENT_ID,
            scopes: ['user-read-email', 'user-read-private', 'user-library-read','user-library-modify'],
            usePKCE: true,
            redirectUri: REDIRECT_URI,
        },
        discovery
    );

    const result = await request.promptAsync(discovery);

    console.log(result);

    if (result.type !== 'success') {
        console.log('connexion annulée');
        return null;
    }

    console.log(' code reçu ? :', result.params.code.substring(0, 30) + '...');

    const tokenResponse = await fetch(discovery.tokenEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            grant_type: 'authorization_code',
            code: result.params.code,
            redirect_uri: REDIRECT_URI,
            client_id: CLIENT_ID,
            code_verifier: request.codeVerifier || '',
        }).toString(),
    });

    const data = await tokenResponse.json();
    console.log(' reponse token:', data);

    return data;
};

export const getSpotifyUserProfile = async (accessToken: string) => {
    const user = await fetch('https://api.spotify.com/v1/me', {
        headers: {
            Authorization: `Bearer ${accessToken}`,
        },
    });

    if (!user.ok) {
        throw new Error('Impossible de récupérer le profil Spotify');
    }

    return await user.json();
};
