import * as WebBrowser from 'expo-web-browser';
import * as AuthSession from 'expo-auth-session';

WebBrowser.maybeCompleteAuthSession();

const CLIENT_ID = process.env.EXPO_PUBLIC_SPOTIFY_CLIENT_ID!;
// calcule la bonne URI automatiquement, un "localhost" en dur marcherait pas sur un vrai téléphone
const REDIRECT_URI = AuthSession.makeRedirectUri({ scheme: 'guesstracks' });

const discovery = {
    authorizationEndpoint: 'https://accounts.spotify.com/authorize',
    tokenEndpoint: 'https://accounts.spotify.com/api/token',
};

const AUTH_CONFIG = {
    clientId: CLIENT_ID,
    scopes: ['user-read-email', 'user-read-private', 'user-library-read', 'user-library-modify'],
    usePKCE: true,
    redirectUri: REDIRECT_URI,
    // sans ça la popup réutilise la session Spotify déjà active sans rien
    // montrer, dcp impossible de changer de compte. show_dialog force l'écran de connexion.
    extraParams: { show_dialog: 'true' },
};

// on précalcule la requête PKCE en dehors du clic, en gros sur web le
// navigateur bloque la popup si window.open() est pas appelé direct dans le
// clic. Dcp en préchargeant ici, y'a plus rien à attendre au clic.
let pendingRequest: Promise<AuthSession.AuthRequest> = AuthSession.loadAsync(AUTH_CONFIG, discovery);
// une requête PKCE marche qu'une fois, on en prépare direct une nouvelle pour la prochaine tentative
const preloadNextRequest = () => {
    pendingRequest = AuthSession.loadAsync(AUTH_CONFIG, discovery);
    pendingRequest.catch(() => {});
};
pendingRequest.catch(() => {});

export const loginWithSpotify = async () => {
    if (__DEV__) {
        console.log('--------------------------------------------------------------------------');
        console.log('redirect URI (à whitelister dans le dashboard Spotify) :', REDIRECT_URI);
    }

    const request = await pendingRequest;
    preloadNextRequest();

    const result = await request.promptAsync(discovery);

    if (result.type !== 'success') {
        console.log('connexion annulée');
        return null;
    }

    if (__DEV__) {
        console.log('code Spotify reçu :', result.params.code.length, 'caractères');
    }

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
    // jamais logger data ici, y'a l'access_token en clair dedans
    if (!tokenResponse.ok) {
        throw new Error(data?.error_description || data?.error || 'Échec de connexion Spotify');
    }

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
