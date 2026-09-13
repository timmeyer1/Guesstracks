import * as WebBrowser from 'expo-web-browser';
import * as AuthSession from 'expo-auth-session';
import * as Linking from 'expo-linking';
import { LOBBY_SERVER_URL } from '../../core/constants';

WebBrowser.maybeCompleteAuthSession();

const APP_ID = process.env.EXPO_PUBLIC_DEEZER_APP_ID!;
// même logique que spotify.ts, calcule la bonne URI de redirection tout seul
const REDIRECT_URI = AuthSession.makeRedirectUri({ scheme: 'guesstracks' });
// manage_library en gros pour lire les titres favoris de l'utilisateur
const PERMS = 'basic_access,email,manage_library';

const AUTHORIZE_URL = 'https://connect.deezer.com/oauth/auth.php';

// Deezer supporte pas PKCE contrairement à Spotify, dcp c'est notre serveur
// qui échange le code contre un token, lui seul a le secret d'app Deezer
export const loginWithDeezer = async () => {
    if (__DEV__) {
        console.log('--------------------------------------------------------------------------');
        console.log('redirect URI (à whitelister dans le dashboard Deezer) :', REDIRECT_URI);
    }

    const authUrl =
        `${AUTHORIZE_URL}?app_id=${encodeURIComponent(APP_ID)}` +
        `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}` +
        `&perms=${encodeURIComponent(PERMS)}`;

    const result = await WebBrowser.openAuthSessionAsync(authUrl, REDIRECT_URI);

    if (result.type !== 'success' || !result.url) {
        console.log('connexion annulée');
        return null;
    }

    const { queryParams } = Linking.parse(result.url);
    const code = queryParams?.code;

    if (typeof code !== 'string') {
        console.log('code Deezer manquant dans la réponse');
        return null;
    }

    if (__DEV__) {
        console.log('code Deezer reçu :', code.length, 'caractères');
    }

    const tokenResponse = await fetch(`${LOBBY_SERVER_URL}/api/auth/deezer/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, redirectUri: REDIRECT_URI }),
    });

    const data = await tokenResponse.json();
    // jamais logger data ici, y'a l'access_token en clair dedans
    if (!tokenResponse.ok) {
        throw new Error(data?.error || 'Échec de connexion Deezer');
    }

    return data;
};
