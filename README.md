# Guesstracks

App Expo/React Native + serveur de lobby Node/MongoDB, connexion Spotify.
Une application mobile (IOS & Android) où tu peux jouer avec tes amis. Ils se connectent dès le début avec Spotify, Deezer, Apple Music et Youtube Music. Ça reprend leur playlist “titres likés” et il y a des manches de 5 à 20 rounds (l’host de la partie peut choisir). Si l’extrait d’une musique est possible, ça met l’extrait. Une musique peut être likée par plusieurs personnes donc ça doit dire "Qui sont les personnes qui ont liké cette musique ?". Y a un système de point avec la vitesse de chaque utilisateur pour trouver la réponse, s'ils ont bon ou pas, s’ils ont eu une une / plusieurs ou toutes les bonnes réponses, leur série de bonnes réponses… Et enfin les stats finales et le classement. Ce mode s’appelle Guesstracks. Il y a aussi un mode Blindtest où le but est de reconnaitre la musique le plus rapidement possible.

## Prérequis

- Node.js 20+
- MongoDB local (`mongod`)
- Expo Go (test sur appareil physique)
- App créée sur https://developer.spotify.com/dashboard

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

## Dashboard Spotify

Settings → Redirect URIs, ajouter :

- `guesstracks://callback`
- `exp://<IP_LOCALE>:8081` (visible dans les logs à la connexion, cf. `app/modules/auth/spotify.ts`)

Ces IP changent si le réseau change → mettre à jour `.env` et le dashboard.

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

## Dépannage

- **"Impossible de joindre le serveur de jeu"** → `EXPO_PUBLIC_LOBBY_SERVER_URL` mal configuré, ou serveur/MongoDB éteints
- **Connexion Spotify en boucle / écran bleu** → redirect URI non whitelistée dans le dashboard Spotify
- **Serveur ne démarre pas** → MongoDB éteint ou `MONGODB_URI` invalide
