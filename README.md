# Guesstracks

App Expo/React Native + serveur de lobby Node/MongoDB, connexion Spotify.
Une application mobile (IOS & Android) où tu peux jouer avec tes amis. Ils se connectent dès le début avec Spotify, Deezer, Apple Music et Youtube Music. Ça reprend leur playlist “titres likés” et il y a des manches de 5 à 20 rounds (l’host de la partie peut choisir). Si l’extrait d’une musique est possible, ça met l’extrait. Une musique peut être likée par plusieurs personnes donc ça doit dire "Qui sont les personnes qui ont liké cette musique ?". Y a un système de point avec la vitesse de chaque utilisateur pour trouver la réponse, s'ils ont bon ou pas, s’ils ont eu une une / plusieurs ou toutes les bonnes réponses, leur série de bonnes réponses… Et enfin les stats finales et le classement. Ce mode s’appelle Guesstracks. Il y a aussi un mode Blindtest où le but est de reconnaitre la musique le plus rapidement possible.

## Prérequis

- Node.js 20+
- MongoDB local (`mongod`)
- Expo Go (test sur appareil physique)
- App créée sur https://developer.spotify.com/dashboard
- Deezer : rien à créer. La connexion Deezer se fait par lookup de profil
  public (l'utilisateur colle son lien de profil), sans app ni OAuth — voir
  "Connexion Deezer" plus bas. Le flux OAuth existe dans le code
  (`app/modules/auth/deezer.ts` + `server/src/routes/auth.routes.js`) mais est
  dormant tant que https://developers.deezer.com/myapps (création d'app) est
  cassé côté Deezer

## Installation

```bash
npm install
cd server && npm install
```

## Config `.env` (racine)

```bash
cp .env.example .env
```

- `EXPO_PUBLIC_SPOTIFY_CLIENT_ID` : Client ID depuis le dashboard Spotify
- `EXPO_PUBLIC_DEEZER_APP_ID` : uniquement utile si le flux OAuth Deezer est un
  jour réactivé (cf. "Connexion Deezer" plus bas) — peut rester vide pour l'instant
- `EXPO_PUBLIC_LOBBY_SERVER_URL` : `http://<IP_LOCALE>:4000`

IP locale (macOS) : `ipconfig getifaddr en0`

Ne pas laisser `localhost` si test sur appareil physique — sinon erreur "Impossible de joindre le serveur de jeu".

## Config `server/.env`

```bash
cp server/.env.example server/.env
```

- `MONGODB_URI` : `mongodb://127.0.0.1:27017/guesstracks`
- `PORT` : `4000`
- `CORS_ORIGIN` : `*`
- `DEEZER_APP_ID` / `DEEZER_APP_SECRET` : uniquement utile si le flux OAuth
  Deezer est un jour réactivé (cf. "Connexion Deezer" plus bas) — peut rester
  vide pour l'instant. Le secret ne doit jamais être mis dans l'app mobile :
  Deezer ne supporte pas PKCE, l'échange code → token serait fait par ce
  serveur (`POST /api/auth/deezer/token`, cf. `server/src/routes/auth.routes.js`)

## Dashboard Spotify

Settings → Redirect URIs, ajouter :

- `guesstracks://callback`
- `exp://<IP_LOCALE>:8081` (visible dans les logs à la connexion, cf. `app/modules/auth/spotify.ts`)

Ces IP changent si le réseau change → mettre à jour `.env` et le dashboard.
En tunnel (`expo start --tunnel`), l'URI affichée dans les logs change à
chaque redémarrage du tunnel — même remarque.

## Connexion Deezer

La création d'app sur https://developers.deezer.com/myapps est cassée côté
Deezer depuis ~2 ans (portail indisponible), donc pas d'OAuth possible pour
l'instant. En attendant, la connexion Deezer utilise le lookup de profil
public de Deezer : `GET https://api.deezer.com/user/{id}/tracks`, qui ne
nécessite aucune authentification tant que l'utilisateur n'a pas rendu ses
titres likés privés.

Dans l'app, l'utilisateur colle le lien ou l'ID de son profil Deezer
(`deezer.com/profile/<id>`, visible dans son propre profil → Partager). Rien à
configurer côté `.env` pour ce chemin.

Le flux OAuth complet existe déjà dans le code (`app/modules/auth/deezer.ts`,
`app/modules/deezer/deezer.api.ts` méthodes `getUserProfile`/
`getUserFavoriteTracks`, `server/src/routes/auth.routes.js`) et n'attend qu'un
`app_id`/`secret` Deezer pour être rebranché sur le bouton de l'écran de
connexion (`app/screens/login.screen.tsx`) une fois le portail développeur
Deezer réparé. Le dashboard Deezer attendrait alors les mêmes redirect URIs
que Spotify ci-dessus.

## Démarrage

```bash
# MongoDB
brew services start mongodb-community

# Serveur (dans /server)
npm run dev

# App (racine)
npx expo start
```

Vérifier le serveur : `curl http://localhost:4000/health` → `{"ok":true}`

Après modif d'un `.env` : `npx expo start -c`

### Ami sur un autre réseau

Le serveur (port 4000) n'est accessible que sur le réseau local par défaut.
Pour qu'un ami hors de ce réseau puisse rejoindre, il faut exposer le port
4000 via [ngrok](https://ngrok.com).

**Installation (une seule fois) :**

```bash
brew install ngrok
```

**Créer un compte (une seule fois)** — ngrok exige un compte gratuit depuis
2023 pour utiliser le tunnel, même en usage ponctuel :

1. Aller sur https://dashboard.ngrok.com/signup et créer un compte (email, ou
   Google/GitHub)
2. Une fois connecté, le token est affiché directement sur
   https://dashboard.ngrok.com/get-started/your-authtoken — le copier
3. L'enregistrer en local :

```bash
ngrok config add-authtoken <le_token_copié>
```

**À chaque session avec un ami distant :**

```bash
# terminal 1 : le serveur (cf. "Démarrage" plus haut)
cd server && npm run dev

# terminal 2 : le tunnel vers le serveur
ngrok http 4000
```

`ngrok` affiche une ligne `Forwarding` du type
`https://xxxx.ngrok-free.app -> http://localhost:4000` : copier cette URL
dans `EXPO_PUBLIC_LOBBY_SERVER_URL` (`.env` racine), puis relancer l'app en
tunnel :

```bash
# terminal 3 : l'app, avec cache vidé (le .env a changé) et en tunnel
npx expo start -c --tunnel
```

Envoyer le lien `exp://...` affiché à l'ami (ouverture directe dans Expo Go).

⚠️ Les 3 terminaux (serveur, ngrok, Expo) doivent rester ouverts pendant
toute la session — fermer l'un d'eux coupe la partie pour tout le monde,
vous y compris. L'URL ngrok **change à chaque redémarrage de `ngrok`** (plan
gratuit) : il faut alors répéter l'étape "copier l'URL dans `.env`, relancer
Expo".

## Dépannage

- **"Impossible de joindre le serveur de jeu"** → `EXPO_PUBLIC_LOBBY_SERVER_URL` mal configuré, ou serveur/MongoDB éteints
- **Connexion Spotify en boucle / écran bleu** → redirect URI non whitelistée dans le dashboard Spotify
- **"Aucun titre liké trouvé" côté Deezer** → le profil Deezer entré est privé (Réglages → Confidentialité → rendre "Titres likés" public), ou l'ID/lien collé est invalide
- **Serveur ne démarre pas** → MongoDB éteint ou `MONGODB_URI` invalide
