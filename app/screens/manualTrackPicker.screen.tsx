import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, TextInput, Pressable, SectionList, ScrollView, Keyboard, Platform } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import { Image } from 'expo-image';
import { useNavigation } from '@react-navigation/native';
import { Search, X, Check, Music } from 'lucide-react-native';
import { COLORS } from '../core/constants/colors.constants';
import { Alert } from '../core/alert';
import { searchDeezerAlbums, type AlbumSearchResult, type SimilarArtist } from '../modules/auth/trackSearch';
import { useManualTrackPickerStore } from '../stores/manualTrackPicker.store';
import { useWebSafeAreaInsets } from '../core/hooks/useWebSafeAreaInsets';
import { ScreenLayout } from '../components/ScreenLayout';
import { CustomButton } from '../components/Button';
import { IconButton } from '../components/IconButton';
import type { TrackType } from '../core/types';

const MIN_QUERY_LENGTH = 2;
// distance (px) à partir de laquelle un mouvement du doigt sur la liste des
// résultats est considéré comme un vrai glissement plutôt qu'un tap (cf.
// touchStartRef plus bas pour le pourquoi)
const SCROLL_DISMISS_THRESHOLD_PX = 10;
// laisse le temps à la frappe de se stabiliser avant de lancer une requête
// réseau : évite une requête (recherche + tracklists des albums trouvés,
// cf. server/src/services/deezer.service.js) par caractère tapé
const SEARCH_DEBOUNCE_MS = 350;
// en dessous, une partie n'a quasiment aucun intérêt (trop peu de titres à
// deviner) — cohérent avec MIN_ROUNDS_PLAYABLE côté serveur (cf.
// server/src/constants.js), sans lui être couplé en dur
const MIN_MANUAL_TRACKS = 3;
// nombre CIBLE affiché dans le compteur (cf. le badge plus bas) — PAS une
// limite dure : l'utilisateur reste libre d'en sélectionner davantage s'il le
// souhaite, rien ne bloque au-delà
const TARGET_MANUAL_TRACKS = 20;
// garantit un minimum de variété dans la sélection (pas uniquement des
// titres du même artiste) : un nombre d'artistes DISTINCTS plutôt qu'un
// simple nombre de titres, qui n'empêchait pas ce cas
const MIN_UNIQUE_ARTISTS = 5;
// "Leto feat. PLK" ne doit compter que pour Leto (l'artiste principal) pour
// cette variété — sinon un featuring gonflait le compte à deux artistes pour
// un seul titre choisi (constaté en pratique). Même convention "X feat. Y"
// que app/modules/spotify/spotify.service.ts (formatArtists) ; "ft."/
// "featuring" couverts aussi, au cas où une source les utilise à la place.
const FEATURED_ARTIST_SEPARATOR = /\s+(?:feat\.?|ft\.?|featuring)\s+/i;
const getPrimaryArtist = (artist: string) => artist.split(FEATURED_ARTIST_SEPARATOR)[0].trim();

// suggestions par défaut avant toute recherche (cf. plus bas) : liste EN DUR,
// pas une requête Deezer (ex: un endpoint "top artistes") — cet écran n'a pas
// besoin d'un classement à jour à la seconde près pour donner un point de
// départ, et ça évite un appel réseau supplémentaire au premier affichage,
// avant même que l'utilisateur ait tapé quoi que ce soit. Quelques valeurs
// sûres et durables (têtes d'affiche internationales depuis plusieurs années)
// plutôt qu'un classement précis et daté dans 6 mois. Les pochettes sont
// elles aussi codées en dur (URL Deezer résolue une fois pour toutes) : là
// encore, aucun appel réseau depuis l'app pour les obtenir, seulement pour
// charger l'image elle-même — exactement comme les pochettes d'album déjà
// affichées ailleurs (cf. track.image).
type DefaultArtist = { name: string; picture: string };
type DefaultArtistCategory = { label: string; artists: DefaultArtist[] };
// groupés par GENRE (pas par pays) : un libellé affiché au-dessus de chaque
// catégorie (cf. plus bas), séparée de la suivante par un simple trait fin —
// plus explicite qu'un regroupement muet par nationalité pour piocher dans un
// style précis
const DEFAULT_ARTIST_SUGGESTIONS: DefaultArtistCategory[] = [
    {
        label: 'Rock',
        artists: [
            { name: 'Queen', picture: 'https://cdn-images.dzcdn.net/images/artist/71eeb9e2eeb375df35a3c0654a5a01ab/250x250-000000-80-0-0.jpg' },
            { name: 'Nirvana', picture: 'https://cdn-images.dzcdn.net/images/artist/3ec5542ff520ee74e2befdaba32ef2ef/250x250-000000-80-0-0.jpg' },
            { name: 'AC/DC', picture: 'https://cdn-images.dzcdn.net/images/artist/7dbc950be70f997ba0cd2b39de7f2aa7/250x250-000000-80-0-0.jpg' },
            { name: 'Coldplay', picture: 'https://cdn-images.dzcdn.net/images/artist/3087954bca22f306324912e5ac8375c3/250x250-000000-80-0-0.jpg' },
            { name: 'Imagine Dragons', picture: 'https://cdn-images.dzcdn.net/images/artist/1ba025c23cae3dee14b51152990285fc/250x250-000000-80-0-0.jpg' },
        ],
    },
    {
        label: 'Rap US',
        artists: [
            { name: 'Travis Scott', picture: 'https://cdn-images.dzcdn.net/images/artist/8d8316146026d7e6ce377e314536df62/250x250-000000-80-0-0.jpg' },
            { name: 'Kendrick Lamar', picture: 'https://cdn-images.dzcdn.net/images/artist/be0a7c550567f4af0ed202d7235b74d6/250x250-000000-80-0-0.jpg' },
            { name: 'Drake', picture: 'https://cdn-images.dzcdn.net/images/artist/70223888f501f4b843142e071abda364/250x250-000000-80-0-0.jpg' },
            { name: 'SZA', picture: 'https://cdn-images.dzcdn.net/images/artist/8ced041da2bed70d5715f0860956169b/250x250-000000-80-0-0.jpg' },
            { name: 'Doja Cat', picture: 'https://cdn-images.dzcdn.net/images/artist/9e3a3b8792a04c4578da7b905ffeaf2b/250x250-000000-80-0-0.jpg' },
            { name: 'Playboi Carti', picture: 'https://cdn-images.dzcdn.net/images/artist/b90097972a60d9d8598a79a786be1a3a/250x250-000000-80-0-0.jpg' },
        ],
    },
    {
        label: 'Pop internationale',
        artists: [
            { name: 'Michael Jackson', picture: 'https://cdn-images.dzcdn.net/images/artist/97fae13b2b30e4aec2e8c9e0c7839d92/250x250-000000-80-0-0.jpg' },
            { name: 'Taylor Swift', picture: 'https://cdn-images.dzcdn.net/images/artist/e528e270424103b527f8a27ac625563b/250x250-000000-80-0-0.jpg' },
            { name: 'Billie Eilish', picture: 'https://cdn-images.dzcdn.net/images/artist/8eab1a9a644889aabaca1e193e05f984/250x250-000000-80-0-0.jpg' },
            { name: 'Ariana Grande', picture: 'https://cdn-images.dzcdn.net/images/artist/721d8fab84b315502de422b8d0901509/250x250-000000-80-0-0.jpg' },
            { name: 'Justin Bieber', picture: 'https://cdn-images.dzcdn.net/images/artist/fe097f693cebf1f882e3da79e99e3bf9/250x250-000000-80-0-0.jpg' },
            { name: 'The Weeknd', picture: 'https://cdn-images.dzcdn.net/images/artist/581693b4724a7fcfa754455101e13a44/250x250-000000-80-0-0.jpg' },
            { name: 'Ed Sheeran', picture: 'https://cdn-images.dzcdn.net/images/artist/d6bb84390641d8ae9118228d9544e53d/250x250-000000-80-0-0.jpg' },
            { name: 'Sam Smith', picture: 'https://cdn-images.dzcdn.net/images/artist/df9a62e39aabc1977f3b0bb85998bba8/250x250-000000-80-0-0.jpg' },
            { name: 'PinkPantheress', picture: 'https://cdn-images.dzcdn.net/images/artist/dbf10322b8c415487c9caa678f4d82f6/250x250-000000-80-0-0.jpg' },
        ],
    },
    {
        label: 'Rap FR',
        artists: [
            { name: 'Jul', picture: 'https://cdn-images.dzcdn.net/images/artist/b1e9d9f4c65beca2e8fe0811e4e1e0aa/250x250-000000-80-0-0.jpg' },
            { name: 'PLK', picture: 'https://cdn-images.dzcdn.net/images/artist/092f633e7111bd134419146d2b7f32ee/250x250-000000-80-0-0.jpg' },
            { name: 'Gazo', picture: 'https://cdn-images.dzcdn.net/images/artist/d4cd3a4cdd4cc58ac5f4e9bab535e3b2/250x250-000000-80-0-0.jpg' },
            { name: 'Ninho', picture: 'https://cdn-images.dzcdn.net/images/artist/7601c5c0e2bd16cb585898316fd0dfec/250x250-000000-80-0-0.jpg' },
            { name: 'Orelsan', picture: 'https://cdn-images.dzcdn.net/images/artist/cb21b6617783e6050240ba76ca9b3034/250x250-000000-80-0-0.jpg' },
            { name: 'SCH', picture: 'https://cdn-images.dzcdn.net/images/artist/8d9c407bd25fab0fc961b6abf335e874/250x250-000000-80-0-0.jpg' },
            { name: 'Gambi', picture: 'https://cdn-images.dzcdn.net/images/artist/e51a371262f19bb529820f88527d1410/250x250-000000-80-0-0.jpg' },
            { name: 'La Rvfleuze', picture: 'https://cdn-images.dzcdn.net/images/artist/5d55b6b4ffc4d8510250b2043ca66999/250x250-000000-80-0-0.jpg' },
        ],
    },
    {
        label: 'Variété française',
        artists: [
            { name: 'Aya Nakamura', picture: 'https://cdn-images.dzcdn.net/images/artist/c8bca3e6aed3da8de8cbe0edd91bc156/250x250-000000-80-0-0.jpg' },
            { name: 'Vitaa', picture: 'https://cdn-images.dzcdn.net/images/artist/a32b590da0a3b2a1da0c86fa6cdba8f5/250x250-000000-80-0-0.jpg' },
            { name: 'Kendji Girac', picture: 'https://cdn-images.dzcdn.net/images/artist/8937abf847aeabbaa7b8ec908c1509d4/250x250-000000-80-0-0.jpg' },
            { name: 'Amir', picture: 'https://cdn-images.dzcdn.net/images/artist/2a46840f4e1341a223adc3e7d033827c/250x250-000000-80-0-0.jpg' },
            { name: 'Zaz', picture: 'https://cdn-images.dzcdn.net/images/artist/4286b70b804735592fabfaee092e69c2/250x250-000000-80-0-0.jpg' },
            { name: 'GIMS', picture: 'https://cdn-images.dzcdn.net/images/artist/ba02785ee0a58180ca0e8dd37190d107/250x250-000000-80-0-0.jpg' },
            { name: 'Christophe Maé', picture: 'https://cdn-images.dzcdn.net/images/artist/f371ce72486a624fd17f7860fb3d7c6f/250x250-000000-80-0-0.jpg' },
            { name: 'Theodora', picture: 'https://cdn-images.dzcdn.net/images/artist/5165b12a16269bbbb560134997f3f744/250x250-000000-80-0-0.jpg' },
            { name: 'Céline Dion', picture: 'https://cdn-images.dzcdn.net/images/artist/e3ae78e5c49ed42342513d5a248b9c4c/250x250-000000-80-0-0.jpg' },
            { name: 'Johnny Hallyday', picture: 'https://cdn-images.dzcdn.net/images/artist/a8cbf6cc9d2808237b23b1159b56afba/250x250-000000-80-0-0.jpg' },
        ],
    },
    {
        label: 'Rap UK / Drill',
        artists: [
            { name: 'Central Cee', picture: 'https://cdn-images.dzcdn.net/images/artist/25fe719f51af3ee2de27aa267e2a6ac9/250x250-000000-80-0-0.jpg' },
            { name: 'Dave', picture: 'https://cdn-images.dzcdn.net/images/artist/eb2c8952b7328fdf32b3546d5ffab8c2/250x250-000000-80-0-0.jpg' },
            { name: 'Stormzy', picture: 'https://cdn-images.dzcdn.net/images/artist/fbf2218aa7d8262098c19097bd10cb21/250x250-000000-80-0-0.jpg' },
            { name: 'Aitch', picture: 'https://cdn-images.dzcdn.net/images/artist/c17d03daafa22e101246fba24548bc53/250x250-000000-80-0-0.jpg' },
            { name: 'Headie One', picture: 'https://cdn-images.dzcdn.net/images/artist/ca5b97695d26045d952ea62a0243bf08/250x250-000000-80-0-0.jpg' },
        ],
    },
    {
        label: 'Latino',
        artists: [
            { name: 'Bad Bunny', picture: 'https://cdn-images.dzcdn.net/images/artist/044a3f315b041864887a8dd8709e6926/250x250-000000-80-0-0.jpg' },
            { name: 'Karol G', picture: 'https://cdn-images.dzcdn.net/images/artist/5b0aab23f8d2856951a92f3a9faf70e3/250x250-000000-80-0-0.jpg' },
            { name: 'Peso Pluma', picture: 'https://cdn-images.dzcdn.net/images/artist/dde2bf89c1e8da0aeb94436681bc3aac/250x250-000000-80-0-0.jpg' },
            { name: 'Feid', picture: 'https://cdn-images.dzcdn.net/images/artist/e629c93e03b3c225d8d52a42bae71537/250x250-000000-80-0-0.jpg' },
            { name: 'Rauw Alejandro', picture: 'https://cdn-images.dzcdn.net/images/artist/0e7b2b93b91789a054bc3f08bb3df3a8/250x250-000000-80-0-0.jpg' },
            { name: 'Rosalía', picture: 'https://cdn-images.dzcdn.net/images/artist/96636156440182f1e7db3f77d39e6545/250x250-000000-80-0-0.jpg' },
            { name: 'Quevedo', picture: 'https://cdn-images.dzcdn.net/images/artist/79880cc1b999b15567e332203464c34e/250x250-000000-80-0-0.jpg' },
            { name: 'C. Tangana', picture: 'https://cdn-images.dzcdn.net/images/artist/0e48ef0b911fe883e0eaa67350c85c46/250x250-000000-80-0-0.jpg' },
        ],
    },
    {
        label: 'Funk brésilien',
        artists: [
            { name: 'Anitta', picture: 'https://cdn-images.dzcdn.net/images/artist/e1a33054b719a936f00dc2050f3c90a9/250x250-000000-80-0-0.jpg' },
            { name: 'Ludmilla', picture: 'https://cdn-images.dzcdn.net/images/artist/55ecebdb6fdb2a1a97fff0e9d1ceed70/250x250-000000-80-0-0.jpg' },
            { name: 'Iza', picture: 'https://cdn-images.dzcdn.net/images/artist/e1ecee874c34733da4f207c4133e61e8/250x250-000000-80-0-0.jpg' },
            { name: 'MC Kevinho', picture: 'https://cdn-images.dzcdn.net/images/artist/3549481bbfd3415ba247b411eea2f8d0/250x250-000000-80-0-0.jpg' },
            { name: 'Pedro Sampaio', picture: 'https://cdn-images.dzcdn.net/images/artist/706ab941f922fb5820680cdceb284862/250x250-000000-80-0-0.jpg' },
        ],
    },
    {
        label: 'Afrobeats',
        artists: [
            { name: 'Burna Boy', picture: 'https://cdn-images.dzcdn.net/images/artist/ad15b7f03325752d60db9e4d39c079ae/250x250-000000-80-0-0.jpg' },
            { name: 'Wizkid', picture: 'https://cdn-images.dzcdn.net/images/artist/171332ffcaa66c2b5583d7630297be88/250x250-000000-80-0-0.jpg' },
            { name: 'Davido', picture: 'https://cdn-images.dzcdn.net/images/artist/bb20fa59263d537ce7a27160b8471aed/250x250-000000-80-0-0.jpg' },
            { name: 'Rema', picture: 'https://cdn-images.dzcdn.net/images/artist/078018d591ab3ac531284044d4d4b388/250x250-000000-80-0-0.jpg' },
            { name: 'Tems', picture: 'https://cdn-images.dzcdn.net/images/artist/b39b511ce7252fc5a94c55e08c6cf118/250x250-000000-80-0-0.jpg' },
        ],
    },
    {
        label: 'K-pop',
        artists: [
            { name: 'BTS', picture: 'https://cdn-images.dzcdn.net/images/artist/b5c64fa8216ca158e52b4d88bd9388ff/250x250-000000-80-0-0.jpg' },
            { name: 'NewJeans', picture: 'https://cdn-images.dzcdn.net/images/artist/0866c2c1d7d00879f5db46ddc1250db8/250x250-000000-80-0-0.jpg' },
            { name: 'Stray Kids', picture: 'https://cdn-images.dzcdn.net/images/artist/15f8a188ec2261e9d1b6b706943ddaf5/250x250-000000-80-0-0.jpg' },
            { name: 'BLACKPINK', picture: 'https://cdn-images.dzcdn.net/images/artist/89675729453893a91be35bde691050ff/250x250-000000-80-0-0.jpg' },
            { name: 'TWICE', picture: 'https://cdn-images.dzcdn.net/images/artist/1f4acadade675899b7f775ae4ac67faa/250x250-000000-80-0-0.jpg' },
        ],
    },
    {
        label: 'Phonk',
        artists: [
            { name: 'Kordhell', picture: 'https://cdn-images.dzcdn.net/images/artist/b0e3818ef24fa20e3170814d6a763e59/250x250-000000-80-0-0.jpg' },
            { name: 'DVRST', picture: 'https://cdn-images.dzcdn.net/images/artist/c16aa18055c7c02a2d012b24f25dc400/250x250-000000-80-0-0.jpg' },
            { name: 'Interworld', picture: 'https://cdn-images.dzcdn.net/images/artist/983ca9673268b4ad9f3b49317ab8a0ee/250x250-000000-80-0-0.jpg' },
            { name: 'Freddie Dredd', picture: 'https://cdn-images.dzcdn.net/images/artist/8becee54612482c4ff5b37546199971f/250x250-000000-80-0-0.jpg' },
            { name: 'KSLV Noh', picture: 'https://cdn-images.dzcdn.net/images/artist/1a8c935f9fa1080ad747db6c91b2b107/250x250-000000-80-0-0.jpg' },
        ],
    },
    {
        label: 'Metal',
        artists: [
            { name: 'Metallica', picture: 'https://cdn-images.dzcdn.net/images/artist/056578a9c2007f69ce198c81875eca41/250x250-000000-80-0-0.jpg' },
            { name: 'System of a Down', picture: 'https://cdn-images.dzcdn.net/images/artist/67460cdb0b52bfde1b807650958058d6/250x250-000000-80-0-0.jpg' },
            { name: 'Slipknot', picture: 'https://cdn-images.dzcdn.net/images/artist/d1a3db36015dd98615f42a5441dcf2f5/250x250-000000-80-0-0.jpg' },
            { name: 'Bring Me the Horizon', picture: 'https://cdn-images.dzcdn.net/images/artist/d159e783c1f419ae27fd2deca5b89b54/250x250-000000-80-0-0.jpg' },
            { name: 'Bullet for My Valentine', picture: 'https://cdn-images.dzcdn.net/images/artist/24af475170a6daa8009ec09896ae07cf/250x250-000000-80-0-0.jpg' },
        ],
    },
    {
        // mélange de bandes-son officielles publiées par le jeu lui-même en
        // tant qu'"artiste" à part entière (League of Legends, VALORANT) et de
        // compositeurs identifiés à un jeu précis (C418/Minecraft, Toby Fox/
        // Undertale) ou à la culture jeu vidéo (The Living Tombstone)
        label: 'Jeux vidéo',
        artists: [
            { name: 'League of Legends', picture: 'https://cdn-images.dzcdn.net/images/artist/21e53b8e8285f84f60601d895c39c900/250x250-000000-80-0-0.jpg' },
            { name: 'VALORANT', picture: 'https://cdn-images.dzcdn.net/images/artist/9c3ba79eed997c70979bc6edbdd518b5/250x250-000000-80-0-0.jpg' },
            { name: 'Toby Fox', picture: 'https://cdn-images.dzcdn.net/images/artist/fc346b96e27af180122e59d2517de00a/250x250-000000-80-0-0.jpg' },
            { name: 'C418', picture: 'https://cdn-images.dzcdn.net/images/artist/9b76ec3fccb7b3831a9cccc2cae5036e/250x250-000000-80-0-0.jpg' },
            { name: 'The Living Tombstone', picture: 'https://cdn-images.dzcdn.net/images/artist/1f20806019d4e615e3201aee4a056bb6/250x250-000000-80-0-0.jpg' },
        ],
    },
];

type Section = { title: string; artist: string; cover: string | null; data: TrackType[] };

type TrackRowProps = { track: TrackType; selected: boolean; onToggle: (track: TrackType) => void };

// Ligne mémoïsée : ne re-rend que si son propre statut de sélection (ou son
// track) change, pas à chaque cochage d'une AUTRE ligne — même pattern que
// SuggestionRow (cf. app/components/game/TrackSuggestionsList.tsx). Sans ça
// (renderItem inline recréé à chaque render, cocher un titre re-rendait donc
// toute la fenêtre visible du SectionList), la virtualisation pouvait
// recycler/réaffecter une cellule PENDANT qu'un toucher était encore en
// cours de résolution : le tap se retrouvait alors appliqué à la ligne du
// dessus ou du dessous plutôt qu'à celle sous le doigt (constaté en
// pratique — cf. onToggle/selectedIds côté appelant, eux aussi stabilisés
// avec useCallback/useMemo pour que ce memo soit réellement efficace).
const TrackRow = React.memo(function TrackRow({ track, selected, onToggle }: TrackRowProps) {
    // petit "pop" à la sélection (grossit) et à la désélection (rétrécit),
    // toujours suivi d'un retour pile à la taille normale, plutôt qu'un
    // déplacement, pour un retour bien visible sans décaler les lignes
    // voisines. Deux withTiming (pas de withSpring) : un aller-retour sec,
    // sans rebond ni oscillation à l'arrivée. Déclenché sur le changement de
    // `selected` plutôt que dans onPress : `selected` ne reflète l'état réel
    // qu'une fois remonté par le parent (cf. selectedIds ci-dessous), donc
    // animer avant coup pourrait jouer le pop même si le toggle est ignoré
    // ailleurs. `prevSelectedRef` distingue sélection et désélection (deux
    // animations différentes) sans jouer quoi que ce soit au premier rendu.
    const jump = useSharedValue(1);
    const prevSelectedRef = useRef(selected);

    useEffect(() => {
        const wasSelected = prevSelectedRef.current;
        prevSelectedRef.current = selected;

        if (selected && !wasSelected) {
            jump.value = withSequence(withTiming(1.06, { duration: 90 }), withTiming(1, { duration: 90 }));
        } else if (!selected && wasSelected) {
            jump.value = withSequence(withTiming(0.94, { duration: 90 }), withTiming(1, { duration: 90 }));
        }
    }, [selected, jump]);

    const jumpStyle = useAnimatedStyle(() => ({
        transform: [{ scale: jump.value }],
    }));

    return (
        <Animated.View style={jumpStyle}>
            <Pressable
                onPress={() => onToggle(track)}
                // marge/arrondi/bordure TOUJOURS présents, identiques dans les deux
                // états (seules la couleur de fond et celle de la bordure changent) :
                // les appliquer seulement quand sélectionné décalait le contenu (la
                // marge de gauche poussait le texte vers la droite au clic, constaté
                // en pratique) — la ligne garde maintenant exactement la même
                // position/taille, sélectionnée ou non
                className={`flex-row items-center py-3.5 pl-2 pr-4 mx-2 my-0.5 rounded-2xl border-b ${
                    selected ? 'bg-primary/10 border-transparent' : 'bg-white border-offwhite'
                }`}
                // retour visuel dès l'appui (avant même le relâchement qui déclenche
                // réellement onPress) : sans ça, rien ne bouge à l'écran tant que le
                // doigt n'est pas relevé, ce qui peut se lire comme un délai avant
                // que l'action ne parte (constaté en pratique — "comme si on
                // attendait le serveur" alors qu'aucun appel réseau n'est en jeu ici)
                style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
            >
                {/* pochette en petit sur chaque titre : celle de l'album n'apparaît
                qu'une fois en en-tête de section (cf. renderSectionHeader plus bas),
                jamais dans la liste des titres déjà sélectionnés (aucun en-tête là) —
                répétée ici, en plus petit, pour rester identifiable partout */}
                {track.image ? (
                    <Image
                        source={{ uri: track.image }}
                        style={{ width: 28, height: 28, borderRadius: 6, marginRight: 8 }}
                        cachePolicy="memory-disk"
                        transition={100}
                    />
                ) : (
                    <View
                        className="bg-offwhite items-center justify-center"
                        style={{ width: 28, height: 28, borderRadius: 6, marginRight: 8 }}
                    >
                        <Music size={12} color={COLORS.darkgray} />
                    </View>
                )}
                <Text className="flex-1 text-black text-sm" numberOfLines={1}>
                    {track.name}
                </Text>
                {/* toujours visible (vide/pleine), au lieu d'un petit ✓ qui
                n'apparaissait qu'une fois sélectionné et passait facilement
                inaperçu (cf. discussion) — juste le glyphe une fois sélectionné,
                sans le gros disque violet plein d'avant (jugé trop imposant) */}
                {selected ? (
                    <View className="w-6 h-6 items-center justify-center">
                        <Check size={18} color={COLORS.primary} strokeWidth={3} />
                    </View>
                ) : (
                    <View className="w-6 h-6 rounded-full border-2 border-offwhite" />
                )}
            </Pressable>
        </Animated.View>
    );
});

const SkeletonBlock = ({ width, height, radius = 6 }: { width: number | `${number}%`; height: number; radius?: number }) => (
    <View className="bg-offwhite" style={{ width, height, borderRadius: radius }} />
);

// nombre de faux albums/titres affichés pendant le chargement : juste assez
// pour remplir l'écran (silhouette plausible), sans avoir besoin de connaître
// la vraie taille des résultats à venir
const SKELETON_ALBUMS = 2;
const SKELETON_TRACKS_PER_ALBUM = 3;
// largeurs variées plutôt qu'une seule valeur fixe : des lignes toutes
// identiques se lisent trop clairement comme un motif répété, moins crédible
// qu'une vraie liste de titres de longueurs différentes
const SKELETON_TITLE_WIDTHS: `${number}%`[] = ['70%', '55%', '45%'];

// silhouette de la mise en page réelle (pochettes + lignes de texte) affichée
// pendant la recherche, à la place d'un simple texte "Recherche..." : donne
// une impression de contenu déjà là (et de la même forme que le résultat final,
// pas de saut de mise en page à l'arrivée des vrais résultats), plutôt qu'un
// écran vide qui se contente de clignoter un mot. Une seule animation de pulsation
// partagée par tous les blocs (au lieu d'une par bloc) : un seul calcul de style
// par frame pour toute la silhouette.
const SearchSkeleton = () => {
    const pulse = useSharedValue(1);

    useEffect(() => {
        pulse.value = withRepeat(withTiming(0.4, { duration: 700 }), -1, true);
    }, [pulse]);

    const pulseStyle = useAnimatedStyle(() => ({ opacity: pulse.value }));

    return (
        <Animated.View style={pulseStyle}>
            {Array.from({ length: SKELETON_ALBUMS }).map((_, albumIndex) => (
                <View key={albumIndex} className={albumIndex > 0 ? 'mt-4' : ''}>
                    <View className="flex-row items-center gap-3 py-2">
                        <SkeletonBlock width={40} height={40} radius={8} />
                        <View className="flex-1" style={{ gap: 6 }}>
                            <SkeletonBlock width="45%" height={12} />
                            <SkeletonBlock width="30%" height={10} />
                        </View>
                    </View>
                    {Array.from({ length: SKELETON_TRACKS_PER_ALBUM }).map((__, trackIndex) => (
                        <View key={trackIndex} className="flex-row items-center py-3.5 pl-2 pr-4 mx-2 my-0.5">
                            <SkeletonBlock width={28} height={28} radius={6} />
                            <View className="flex-1 ml-3">
                                <SkeletonBlock width={SKELETON_TITLE_WIDTHS[trackIndex % SKELETON_TITLE_WIDTHS.length]} height={12} />
                            </View>
                            <SkeletonBlock width={22} height={22} radius={11} />
                        </View>
                    ))}
                </View>
            ))}
        </Animated.View>
    );
};

// Choix manuel des titres pour la "connexion universelle" (cf.
// login.screen.tsx) : un écran à part entière plutôt qu'une modale (plus de
// place pour parcourir des albums entiers), poussé sur la pile pré-connexion
// (cf. Navigator.tsx). Le résultat remonte à LoginScreen via
// useManualTrackPickerStore (cf. ce fichier pour le pourquoi) plutôt que par
// route.params, aucun écran de l'app ne faisant transiter de données ainsi.
export const ManualTrackPickerScreen = () => {
    const navigation = useNavigation();
    const [query, setQuery] = useState('');
    const [debouncedQuery, setDebouncedQuery] = useState('');
    const [albums, setAlbums] = useState<AlbumSearchResult[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [searchError, setSearchError] = useState<string | undefined>(undefined);
    // suggestions d'artistes similaires à celui de la recherche en cours (cf.
    // bandeau du bas plus bas) : PAS remis à vide par handleClearQuery — elles
    // restent affichées même après avoir vidé le champ, pour permettre
    // d'enchaîner vers une nouvelle recherche suggérée sans repartir de zéro.
    // Seule une recherche qui aboutit (ou échoue) les renouvelle, dans l'effet
    // ci-dessous.
    const [similarArtists, setSimilarArtists] = useState<SimilarArtist[]>([]);
    const [selected, setSelected] = useState<TrackType[]>([]);
    const inputRef = useRef<TextInput>(null);
    // remonte la liste tout en haut quand le champ de recherche reprend le
    // focus (cf. onFocus plus bas) : sans ça, après avoir scrollé plus bas
    // dans les résultats (ce qui ferme le clavier) puis retapé le champ, la
    // liste restait scrollée là où l'utilisateur l'avait laissée
    const sectionListRef = useRef<SectionList<TrackType, Section>>(null);
    // ignore la réponse d'une requête devenue obsolète (une recherche plus
    // récente a été lancée entre-temps) plutôt que de laisser la première
    // requête terminée écraser les résultats de la dernière frappe
    const requestIdRef = useRef(0);
    // position du doigt au tout début du geste, sur le SectionList (cf. plus
    // bas) : sert à ne fermer le clavier que sur un VRAI glissement, pas sur
    // le moindre micro-tremblement du doigt pendant un tap. onTouchMove seul
    // se déclenche déjà pour quelques pixels de mouvement (constaté en
    // pratique, même à l'arrêt) ; fermer le clavier à ce moment-là recalcule
    // la hauteur de <html> et scrolle la page à (0,0) (cf. public/index.html)
    // PENDANT que le doigt est encore posé — un titre pouvait alors se
    // décaler sous le doigt entre l'appui et le relâchement, et c'est la
    // ligne du dessus/dessous qui recevait le tap à sa place (constaté en
    // pratique). Un seuil de quelques pixels distingue un vrai glissement
    // (qui le dépasse tout de suite) d'un simple tap (qui ne le dépasse
    // jamais), sans réintroduire ce déplacement de contenu sous le doigt.
    const touchStartRef = useRef<{ x: number; y: number } | null>(null);
    const keyboardDismissedForGestureRef = useRef(false);

    useEffect(() => {
        const timer = setTimeout(() => setDebouncedQuery(query.trim()), SEARCH_DEBOUNCE_MS);
        return () => clearTimeout(timer);
    }, [query]);

    useEffect(() => {
        if (debouncedQuery.length < MIN_QUERY_LENGTH) return;

        const requestId = ++requestIdRef.current;
        setIsSearching(true);
        setSearchError(undefined);
        setAlbums([]);

        searchDeezerAlbums(debouncedQuery)
            .then((result) => {
                if (requestIdRef.current !== requestId) return;
                setAlbums(result.albums);
                setSimilarArtists(result.similarArtists);
            })
            .catch(() => {
                if (requestIdRef.current !== requestId) return;
                setSearchError('Recherche indisponible, réessaie.');
                setAlbums([]);
                setSimilarArtists([]);
            })
            .finally(() => {
                if (requestIdRef.current !== requestId) return;
                setIsSearching(false);
            });
    }, [debouncedQuery]);

    const sections: Section[] = useMemo(
        () => albums.map((album) => ({ title: album.title, artist: album.artist, cover: album.cover, data: album.tracks })),
        [albums]
    );

    // Set plutôt qu'un .some() scanné à chaque ligne à chaque render : O(1)
    // par ligne au lieu de O(n), et surtout une référence qui ne change que
    // lorsque la sélection change réellement — condition nécessaire pour que
    // le memo de TrackRow (cf. plus haut) laisse les lignes NON concernées
    // tranquilles
    const selectedIds = useMemo(() => new Set(selected.map((t) => t.id)), [selected]);

    // useCallback avec un tableau de dépendances vide : la forme fonctionnelle
    // de setSelected n'a besoin d'aucune valeur extérieure, donc cette
    // référence reste stable pour toute la durée de vie de l'écran — sans
    // ça, TrackRow (mémoïsée) se re-rendrait à chaque frappe/sélection quand
    // même, cette prop changeant de référence à chaque render du parent
    const toggleTrack = useCallback((track: TrackType) => {
        setSelected((prev) =>
            // 20 (TARGET_MANUAL_TRACKS) n'est qu'un objectif affiché dans le compteur
            // (cf. le badge plus bas), jamais une limite dure : rien n'empêche d'en
            // sélectionner plus si l'utilisateur le souhaite.
            //
            // le plus récent en tête : la pastille tout juste ajoutée reste
            // visible tout de suite dans la bande horizontale (cf. plus bas,
            // toujours scrollée à son début) sans avoir à glisser vers la
            // droite pour la retrouver et la retirer
            prev.some((t) => t.id === track.id) ? prev.filter((t) => t.id !== track.id) : [track, ...prev]
        );
    }, []);

    // sélectionne l'album entier si au moins un de ses titres ne l'est pas
    // encore, sinon désélectionne tout l'album d'un coup (symétrique à
    // toggleTrack ci-dessus, mais sur toute la tracklist de la section)
    const toggleAlbum = useCallback((tracks: TrackType[]) => {
        setSelected((prev) => {
            const prevIds = new Set(prev.map((t) => t.id));
            const allSelected = tracks.every((t) => prevIds.has(t.id));
            if (allSelected) {
                const albumIds = new Set(tracks.map((t) => t.id));
                return prev.filter((t) => !albumIds.has(t.id));
            }
            // pas de plafond (cf. toggleTrack) : tout l'album manquant est ajouté
            const missing = tracks.filter((t) => !prevIds.has(t.id));
            return [...missing, ...prev];
        });
    }, []);

    const handleClearQuery = () => {
        setQuery('');
        setDebouncedQuery('');
        setAlbums([]);
        setSearchError(undefined);
        requestIdRef.current += 1;
        inputRef.current?.focus();
    };

    const handleClose = () => {
        // même confirmation que "quitter le lobby" (cf. lobby.screen.tsx) :
        // repartir en arrière perdrait toute la sélection en cours, jamais
        // sauvegardée avant l'appui sur "Continuer"
        Alert.alert(
            'Attention !',
            'Es-tu sûr de vouloir quitter ? Les titres sélectionnés seront perdus.',
            [
                { text: 'Rester', style: 'cancel' },
                { text: 'Quitter', style: 'destructive', onPress: () => navigation.goBack() },
            ]
        );
    };

    // Set plutôt qu'un simple .length sur les artistes bruts : deux titres du
    // même artiste (ou un featuring du même artiste principal, cf.
    // getPrimaryArtist) ne doivent compter qu'une fois
    const uniqueArtistCount = useMemo(
        () => new Set(selected.map((t) => getPrimaryArtist(t.artist))).size,
        [selected]
    );

    const handleConfirm = () => {
        if (selected.length < MIN_MANUAL_TRACKS || uniqueArtistCount < MIN_UNIQUE_ARTISTS) return;
        useManualTrackPickerStore.getState().setResult(selected);
        navigation.goBack();
    };

    const tracksMet = selected.length >= MIN_MANUAL_TRACKS;
    const artistsMet = uniqueArtistCount >= MIN_UNIQUE_ARTISTS;
    const canConfirm = tracksMet && artistsMet;
    const showResults = debouncedQuery.length >= MIN_QUERY_LENGTH;

    // cf. touchStartRef plus haut : ne ferme le clavier qu'au-delà d'un vrai
    // déplacement, jamais sur le simple tap d'une ligne ou d'un en-tête d'album
    const handleResultsTouchStart = (e: { nativeEvent: { touches: { pageX: number; pageY: number }[] } }) => {
        const touch = e.nativeEvent.touches[0];
        touchStartRef.current = touch ? { x: touch.pageX, y: touch.pageY } : null;
        keyboardDismissedForGestureRef.current = false;
    };

    const handleResultsTouchMove = (e: { nativeEvent: { touches: { pageX: number; pageY: number }[] } }) => {
        if (keyboardDismissedForGestureRef.current || !touchStartRef.current) return;
        const touch = e.nativeEvent.touches[0];
        if (!touch) return;
        const dx = touch.pageX - touchStartRef.current.x;
        const dy = touch.pageY - touchStartRef.current.y;
        if (Math.hypot(dx, dy) >= SCROLL_DISMISS_THRESHOLD_PX) {
            keyboardDismissedForGestureRef.current = true;
            Keyboard.dismiss();
        }
    };

    // web uniquement (cf. le bandeau du bas plus bas) : hauteur réelle du
    // bandeau, mesurée pour réserver le même espace en bas de la liste — sans
    // ça, en position 'fixed', le bandeau flotte par-dessus les dernières
    // lignes plutôt que de les pousser comme il le faisait en flux normal.
    const [footerHeight, setFooterHeight] = useState(0);
    const isWeb = Platform.OS === 'web';
    const webInsets = useWebSafeAreaInsets();

    // stable également (cf. TrackRow ci-dessus) : sinon SectionList reçoit une
    // nouvelle fonction renderItem à chaque render du parent et perd le
    // bénéfice du memo, exactement comme si TrackRow n'était pas mémoïsée
    const renderItem = useCallback(
        ({ item: track }: { item: TrackType }) => (
            <TrackRow track={track} selected={selectedIds.has(track.id)} onToggle={toggleTrack} />
        ),
        [selectedIds, toggleTrack]
    );

    const renderSectionHeader = useCallback(
        ({ section }: { section: Section }) => (
            <Pressable
                onPress={() => toggleAlbum(section.data)}
                style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
                className="flex-row items-center gap-3 bg-gray-50 py-2"
            >
                {section.cover ? (
                    <Image
                        source={{ uri: section.cover }}
                        style={{ width: 40, height: 40, borderRadius: 8 }}
                        cachePolicy="memory-disk"
                        transition={100}
                    />
                ) : (
                    <View className="bg-offwhite items-center justify-center" style={{ width: 40, height: 40, borderRadius: 8 }}>
                        <Music size={16} color={COLORS.darkgray} />
                    </View>
                )}
                <View className="flex-1">
                    <Text className="text-black font-bold text-sm" numberOfLines={1}>
                        {section.title}
                    </Text>
                    <Text className="text-darkgray text-xs" numberOfLines={1}>
                        {section.artist}
                    </Text>
                </View>
            </Pressable>
        ),
        [toggleAlbum]
    );

    return (
        // pas de KeyboardAvoidingView, volontairement : le champ de recherche
        // est tout en haut de l'écran, jamais recouvert par le clavier, donc
        // rien à faire remonter pour lui.
        //
        // Le bandeau du bas (pastilles + compteur + "Continuer"), lui, est en
        // position 'fixed' sur web SEULEMENT (cf. plus bas) : sur web/PWA, le
        // script de public/index.html force la hauteur de <html> à suivre
        // window.visualViewport pendant que le clavier est ouvert, ce qui
        // faisait "remonter" tout le flux normal (bandeau compris) juste
        // au-dessus du clavier — l'effet d'adaptation qu'on veut justement
        // éviter ici. 'fixed' ancre le bandeau au vrai bas de l'écran
        // (viewport de mise en page, jamais réduit par le clavier sur iOS),
        // qui se retrouve donc masqué SOUS le clavier tant qu'il est ouvert,
        // et réapparaît dès sa fermeture — cf. onTouchMove du SectionList plus
        // bas, qui ferme justement le clavier dès qu'on fait glisser la liste
        // pour le révéler. iOS a un bug documenté où un élément fixed pendant que le
        // clavier est ouvert peut rendre toute la page scrollable ; body a
        // déjà overflow:hidden (cf. public/index.html) et le clavier se ferme
        // dès le premier geste de scroll, ce qui réduit la fenêtre où ce bug
        // peut se produire — à confirmer sur un vrai appareil iOS avant mise
        // en prod. En natif, comportement inchangé (bandeau en flux normal,
        // déjà masqué par le clavier sans display particulier).
        <ScreenLayout>
            <View style={{ flex: 1, width: '100%' }}>
                <View className="flex-row items-center gap-3 mb-2">
                    <IconButton icon="ArrowLeft" onPress={handleClose} variant="white" size="sm" />
                    {/* py-4 (et non py-3) : aligne la hauteur de la barre sur celle de
                    l'IconButton 'sm' à côté (p-4 + icône 24px = 56px des deux côtés) */}
                    <View className="flex-1 flex-row items-center bg-offwhite rounded-2xl px-4 py-4">
                        <Search size={18} color={COLORS.darkgray} />
                        <TextInput
                            ref={inputRef}
                            className="flex-1 ml-2 text-black text-base"
                            style={{ letterSpacing: 0 }}
                            value={query}
                            onChangeText={setQuery}
                            placeholder="Cherche un titre ou un artiste..."
                            placeholderTextColor={COLORS.darkgray}
                            autoCapitalize="none"
                            autoCorrect={false}
                            autoFocus
                            onFocus={() => {
                                if (sections.length > 0 && sections[0].data.length > 0) {
                                    sectionListRef.current?.scrollToLocation({ sectionIndex: 0, itemIndex: 0, animated: true, viewOffset: 0 });
                                }
                            }}
                        />
                        {query.length > 0 && (
                            <Pressable onPress={handleClearQuery} hitSlop={8}>
                                <X size={18} color={COLORS.darkgray} />
                            </Pressable>
                        )}
                    </View>
                </View>

                {/* dénominateur = TARGET_MANUAL_TRACKS (l'objectif de 20 affiché, pas
                une limite) ; le vert, lui, se déclenche dès MIN_MANUAL_TRACKS (3,
                le vrai minimum requis pour continuer) — deux constantes
                différentes, chacune affichée/utilisée à l'endroit qui lui
                correspond */}
                <View className="flex-row items-center justify-center gap-2">
                    <View
                        className={`flex-row items-center rounded-full px-3 py-1 ${
                            tracksMet ? 'bg-success/10' : 'bg-offwhite'
                        }`}
                    >
                        <Text className={`text-xs font-medium ${tracksMet ? 'text-success' : 'text-darkgray'}`}>
                            {selected.length} titre{selected.length > 1 ? 's' : ''} sur {TARGET_MANUAL_TRACKS}
                        </Text>
                        {tracksMet && <Check size={14} color={COLORS.success} strokeWidth={3} style={{ marginLeft: 4 }} />}
                    </View>
                    <Text className="text-darkgray text-xs">/</Text>
                    <View
                        className={`flex-row items-center rounded-full px-3 py-1 ${
                            artistsMet ? 'bg-success/10' : 'bg-offwhite'
                        }`}
                    >
                        <Text className={`text-xs font-medium ${artistsMet ? 'text-success' : 'text-darkgray'}`}>
                            {uniqueArtistCount} artiste{uniqueArtistCount > 1 ? 's' : ''} sur {MIN_UNIQUE_ARTISTS}
                        </Text>
                        {artistsMet && <Check size={14} color={COLORS.success} strokeWidth={3} style={{ marginLeft: 4 }} />}
                    </View>
                </View>

                <View style={{ flex: 1 }} className="mt-2">
                    {!showResults && selected.length === 0 && (
                        <ScrollView
                            showsVerticalScrollIndicator={false}
                            contentContainerStyle={{ paddingBottom: isWeb ? footerHeight + 12 : 12 }}
                        >
                            {DEFAULT_ARTIST_SUGGESTIONS.map((category, categoryIndex) => (
                                <View key={category.label}>
                                    <Text className="text-black text-xs font-bold mb-2">{category.label}</Text>
                                    {/* une View par catégorie : force un vrai retour à la ligne
                                    entre deux genres, plutôt qu'un flex-wrap unique où le dernier
                                    artiste d'une catégorie peut terminer sur la même ligne que le
                                    premier de la suivante selon la largeur d'écran */}
                                    <View className="flex-row flex-wrap justify-center" style={{ gap: 8 }}>
                                        {category.artists.map((artist) => (
                                            <Pressable
                                                key={artist.name}
                                                onPress={() => setQuery(artist.name)}
                                                className="flex-row items-center bg-offwhite rounded-full pl-1 pr-3 py-1 gap-2"
                                            >
                                                <Image
                                                    source={{ uri: artist.picture }}
                                                    style={{ width: 28, height: 28, borderRadius: 14 }}
                                                    cachePolicy="memory-disk"
                                                    transition={100}
                                                />
                                                <Text className="text-black text-xs font-medium">{artist.name}</Text>
                                            </Pressable>
                                        ))}
                                    </View>
                                    {/* trait fin entre catégories, jamais après la dernière */}
                                    {categoryIndex < DEFAULT_ARTIST_SUGGESTIONS.length - 1 && (
                                        <View className="bg-offwhite" style={{ height: 1, marginVertical: 16 }} />
                                    )}
                                </View>
                            ))}
                        </ScrollView>
                    )}

                    {/* tant qu'aucune recherche n'est active, affiche les titres déjà
                    choisis plutôt qu'un écran vide : sans ça, revoir sa sélection (ou
                    en retirer un) obligeait à retaper une recherche pour faire
                    réapparaître la ligne correspondante. Même TrackRow que les
                    résultats (donc même pop de dé/sélection), toujours "selected". */}
                    {!showResults && selected.length > 0 && (
                        <ScrollView
                            showsVerticalScrollIndicator={false}
                            contentContainerStyle={{ paddingBottom: isWeb ? footerHeight + 12 : 12 }}
                        >
                            {selected.map((track) => (
                                <TrackRow key={track.id} track={track} selected onToggle={toggleTrack} />
                            ))}
                        </ScrollView>
                    )}

                    {showResults && isSearching && sections.length === 0 && <SearchSkeleton />}

                    {showResults && !isSearching && searchError && (
                        <Text className="text-sm text-center mt-8" style={{ color: COLORS.disconnect }}>
                            {searchError}
                        </Text>
                    )}

                    {showResults && !isSearching && !searchError && sections.length === 0 && (
                        <Text className="text-darkgray text-sm text-center mt-8">Aucun titre trouvé</Text>
                    )}

                    {showResults && sections.length > 0 && (
                        <SectionList
                            ref={sectionListRef}
                            sections={sections}
                            keyExtractor={(track) => track.id}
                            stickySectionHeadersEnabled
                            // "always" plutôt que "handled" : ce dernier laisse iOS décider
                            // au cas par cas s'il doit d'abord flouter le champ de recherche
                            // avant de transmettre le toucher à la ligne — cette négociation
                            // (et l'animation de fermeture du clavier qu'elle peut déclencher)
                            // pouvait donner l'impression d'un délai avant que la sélection ne
                            // s'affiche. "always" transmet le toucher tel quel, sans détour.
                            keyboardShouldPersistTaps="always"
                            // En natif, onScrollBeginDrag suffit tel quel : il s'est toujours
                            // déclenché correctement là, jamais concerné par les soucis web
                            // ci-dessous (jamais utile d'y toucher le seuil de distance, qui
                            // n'existe QUE pour compenser onTouchMove sur web).
                            //
                            // Sur web, onScrollBeginDrag ne déclenche RIEN : react-native-web ne
                            // câble jamais cette prop à un évènement DOM (son ScrollViewBase ne lit
                            // que onScroll/onTouchMove/onWheel, cf. node_modules/react-native-web/
                            // .../ScrollView/ScrollViewBase.js). onScroll, lui, se déclenche aussi
                            // ~100ms après la fin du scroll (fin du momentum) — un tap sur le champ
                            // de recherche pendant que la liste finit encore de glisser ouvrait bien
                            // le clavier, mais ce même appel de fin de scroll le refermait aussitôt
                            // après (constaté en pratique). onTouchMove seul se déclenche lui AUSSI
                            // sur un simple tap (quelques px de tremblement du doigt suffisent,
                            // constaté en pratique) : fermer le clavier à cet instant décalait le
                            // contenu sous le doigt pendant le tap (cf. public/index.html,
                            // setRealViewportHeight), et c'est la ligne voisine qui recevait le tap
                            // à la place — d'où le seuil de distance (cf. touchStartRef/
                            // handleResultsTouchMove plus haut), qui ne ferme le clavier que sur un
                            // vrai glissement, web uniquement.
                            onScrollBeginDrag={isWeb ? undefined : () => Keyboard.dismiss()}
                            onTouchStart={isWeb ? handleResultsTouchStart : undefined}
                            onTouchMove={isWeb ? handleResultsTouchMove : undefined}
                            showsVerticalScrollIndicator={false}
                            contentContainerStyle={{ paddingBottom: isWeb ? footerHeight + 12 : 12 }}
                            renderSectionHeader={renderSectionHeader}
                            renderItem={renderItem}
                        />
                    )}
                </View>

                <View
                    onLayout={isWeb ? (e) => setFooterHeight(e.nativeEvent.layout.height) : undefined}
                    className={`bg-gray-50 ${isWeb ? 'px-8 pt-2' : ''}`}
                    style={
                        isWeb
                            ? { position: 'fixed' as 'absolute', left: 0, right: 0, bottom: 0, paddingBottom: webInsets.bottom + 32 }
                            : undefined
                    }
                >
                    {similarArtists.length > 0 && (
                        // hauteur fixée à une ligne de pastille : sans borne explicite, une
                        // ScrollView horizontale sans contenu multi-lignes s'étire pour
                        // remplir tout l'espace vertical restant du parent flex (constaté en
                        // pratique — les pastilles se retrouvaient hautes de ~180px)
                        <ScrollView
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            style={{ maxHeight: 44 }}
                            className="mt-3"
                            contentContainerStyle={{ gap: 8, alignItems: 'center' }}
                        >
                            {similarArtists.map((artist) => (
                                // relance directement une recherche sur cet artiste (au lieu
                                // de se contenter de remplir le champ) : setQuery déclenche le
                                // même effet debounce/recherche qu'une frappe normale
                                <Pressable
                                    key={artist.id}
                                    onPress={() => setQuery(artist.name)}
                                    className="flex-row items-center bg-offwhite rounded-full pl-1 pr-3 py-1 gap-2"
                                >
                                    {artist.picture ? (
                                        <Image
                                            source={{ uri: artist.picture }}
                                            style={{ width: 28, height: 28, borderRadius: 14 }}
                                            cachePolicy="memory-disk"
                                            transition={100}
                                        />
                                    ) : (
                                        <View
                                            className="bg-white items-center justify-center"
                                            style={{ width: 28, height: 28, borderRadius: 14 }}
                                        >
                                            <Music size={12} color={COLORS.darkgray} />
                                        </View>
                                    )}
                                    <Text className="text-black text-xs font-medium" numberOfLines={1} style={{ maxWidth: 120 }}>
                                        {artist.name}
                                    </Text>
                                </Pressable>
                            ))}
                        </ScrollView>
                    )}

                    <CustomButton name="Continuer" onPress={handleConfirm} variant="white" available={canConfirm} className="mt-3" />
                </View>
            </View>
        </ScreenLayout>
    );
};
