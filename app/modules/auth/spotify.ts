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

const AUTH_CONFIG = {
    clientId: CLIENT_ID,
    scopes: ['user-read-email', 'user-read-private', 'user-library-read', 'user-library-modify'],
    usePKCE: true,
    redirectUri: REDIRECT_URI,
    // sans ça, la popup web réutilise silencieusement la session Spotify déjà
    // active dans le navigateur (mêmes cookies) et termine l'autorisation
    // sans jamais rien afficher — impossible de choisir un autre compte.
    // show_dialog force Spotify à toujours montrer son écran de connexion/
    // autorisation (avec un lien "Ce n'est pas vous ?" si déjà connecté).
    extraParams: { show_dialog: 'true' },
};

// Pré-calcule la requête PKCE (challenge via expo-crypto, asynchrone) EN
// DEHORS du clic : sur web, request.promptAsync() doit appeler window.open()
// de façon synchrone dans le tick même du clic, sinon le navigateur bloque
// la popup ("Popup window was blocked... invoked too long after a user
// input was fired"). Un `await AuthSession.loadAsync(...)` fait dans le
// handler de clic (comme avant) insère justement ce délai. En préchargeant
// ici, request.url est déjà prêt : promptAsync n'a plus rien à attendre
// avant son propre window.open().
let pendingRequest: Promise<AuthSession.AuthRequest> = AuthSession.loadAsync(AUTH_CONFIG, discovery);
// une requête PKCE n'est valable que pour une seule tentative : en préparer
// tout de suite une nouvelle pour la prochaine (annulation, ou reconnexion
// après un premier essai) plutôt que d'attendre le prochain clic
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
    // jamais logger data ici : contient access_token en clair. En cas
    // d'erreur, ne remonter que le message d'erreur métier (même pattern que
    // deezer.ts, qui avait déjà ce garde-fou).
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
