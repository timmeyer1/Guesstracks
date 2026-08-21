import * as WebBrowser from 'expo-web-browser';
import * as AuthSession from 'expo-auth-session';
import * as Linking from 'expo-linking';
import { LOBBY_SERVER_URL } from '../../core/constants';

WebBrowser.maybeCompleteAuthSession();

const APP_ID = process.env.EXPO_PUBLIC_DEEZER_APP_ID!;
// même logique que app/modules/auth/spotify.ts : calcule automatiquement la
// bonne URI de redirection selon l'environnement (Expo Go, build standalone)
const REDIRECT_URI = AuthSession.makeRedirectUri({ scheme: 'guesstracks' });
// manage_library est nécessaire pour lire les titres favoris de l'utilisateur
// (cf. deezer.api.ts -> GET /user/me/tracks)
const PERMS = 'basic_access,email,manage_library';

const AUTHORIZE_URL = 'https://connect.deezer.com/oauth/auth.php';

// Deezer ne supporte pas PKCE pour les clients publics (contrairement à
// Spotify) : le code renvoyé ici est échangé contre un token par notre
// serveur, seul dépositaire du secret d'app Deezer (cf.
// server/src/routes/auth.routes.js)
export const loginWithDeezer = async () => {
    console.log('--------------------------------------------------------------------------');
    console.log('redirect URI (à whitelister dans le dashboard Deezer) :', REDIRECT_URI);

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

    console.log('code reçu ? :', code.substring(0, 30) + '...');

    const tokenResponse = await fetch(`${LOBBY_SERVER_URL}/api/auth/deezer/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, redirectUri: REDIRECT_URI }),
    });

    const data = await tokenResponse.json();
    console.log(' reponse token:', data);

    if (!tokenResponse.ok) {
        throw new Error(data?.error || 'Échec de connexion Deezer');
    }

    return data;
};
