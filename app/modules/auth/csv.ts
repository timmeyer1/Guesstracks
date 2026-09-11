import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import { Platform } from 'react-native';
import Papa from 'papaparse';
import type { TrackType } from '../../core/types';

// TuneMyMusic (et les autres exports CSV type Exportify) ne garantissent pas
// un nom de colonne unique selon la plateforme source (Spotify, Deezer, Apple
// Music, ...) — on matche donc plusieurs variantes usuelles, insensibles à la
// casse/aux espaces, plutôt que d'exiger un format figé.
const HEADER_ALIASES: Record<'title' | 'artist' | 'album', string[]> = {
    title: ['track title', 'title', 'track name', 'song title', 'song', 'name'],
    artist: ['artist', 'artist name', 'artists'],
    album: ['album', 'album name'],
};

const normalizeHeader = (header: string) => header.trim().toLowerCase();

const findColumn = (headers: string[], aliases: string[]): string | null => {
    const normalized = headers.map(normalizeHeader);
    for (const alias of aliases) {
        const index = normalized.indexOf(alias);
        if (index !== -1) return headers[index];
    }
    return null;
};

export type CsvImportResult = { tracks: TrackType[]; total: number; truncated: boolean };

// mêmes garde-fous que côté serveur (cf. server/src/services/game.service.js,
// submitTracks) : coupe court à un fichier malveillant/corrompu (des millions
// de lignes, un champ de plusieurs Mo...) avant même de tenter de le
// soumettre au lobby, plutôt que de laisser le serveur seul filtrer après
// avoir déjà encaissé tout le payload
const MAX_TRACKS = 5000;
const MAX_FIELD_LENGTH = 300;

const truncateField = (value: string) => value.slice(0, MAX_FIELD_LENGTH);

// pas de token ici : ces titres ne viennent d'aucune API, mais le serveur
// sait déjà retrouver un extrait audio par simple recherche titre+artiste
// (cf. server/src/services/preview.service.js, resolvePreviewUrl) quand
// previewUrl/id ne sont pas fournis — aucune info supplémentaire nécessaire.
export const parseCsvTracks = (content: string): CsvImportResult => {
    const parsed = Papa.parse<Record<string, string>>(content, {
        header: true,
        skipEmptyLines: true,
    });

    const headers = parsed.meta.fields ?? [];
    const titleColumn = findColumn(headers, HEADER_ALIASES.title);
    const artistColumn = findColumn(headers, HEADER_ALIASES.artist);
    const albumColumn = findColumn(headers, HEADER_ALIASES.album);

    if (!titleColumn || !artistColumn) {
        throw new Error("Format de fichier CSV non reconnu (colonnes titre/artiste introuvables)");
    }

    const tracks: TrackType[] = [];
    // au-delà de MAX_TRACKS, les lignes suivantes sont ignorées (le serveur
    // les rejetterait de toute façon, cf. game.service.js submitTracks) —
    // truncated est remonté à l'appelant pour prévenir l'utilisateur plutôt
    // que de le laisser croire que toute sa bibliothèque a été importée.
    // Confirmé (par l'utilisateur, pas par une doc officielle) : TuneMyMusic
    // exporte ses CSV avec les titres likés les plus récents en premier —
    // garder les MAX_TRACKS premières lignes revient donc à garder les plus
    // récents, pas une troncature arbitraire. Ne pas réordonner ce parsing
    // sans revérifier ce point.
    let truncated = false;
    for (const [index, row] of parsed.data.entries()) {
        if (tracks.length >= MAX_TRACKS) {
            truncated = true;
            break;
        }

        const name = row[titleColumn]?.trim();
        const artist = row[artistColumn]?.trim();
        if (!name || !artist) continue;

        tracks.push({
            id: `csv-${index}`,
            name: truncateField(name),
            artist: truncateField(artist),
            album: truncateField((albumColumn ? row[albumColumn]?.trim() : '') || ''),
            provider: 'csv',
        });
    }

    if (tracks.length === 0) {
        throw new Error('Aucun titre trouvé dans ce fichier CSV');
    }

    return { tracks, total: tracks.length, truncated };
};

const readFileContent = async (asset: DocumentPicker.DocumentPickerAsset): Promise<string> => {
    // sur web, expo-document-picker expose directement l'objet File natif du
    // navigateur (uri est un blob: inexploitable par expo-file-system) ; sur
    // natif (iOS/Android), on lit le fichier copié en cache via son uri
    if (Platform.OS === 'web' && asset.file) {
        return await asset.file.text();
    }
    return await new File(asset.uri).text();
};

// une bibliothèque likée réaliste (même plusieurs dizaines de milliers de
// titres) ne dépasse jamais ça en pratique : au-delà, on est sur un fichier
// corrompu ou volontairement abusif — mieux vaut refuser tout de suite que de
// laisser le téléphone/navigateur tenter de le charger en mémoire
const MAX_CSV_FILE_SIZE_BYTES = 20 * 1024 * 1024; // 20 Mo

// ouvre le sélecteur de fichier natif (adapté Android/iPhone/PC) et renvoie
// les titres importés, ou null si l'utilisateur a annulé
export const importTracksFromCsv = async (): Promise<CsvImportResult | null> => {
    const result = await DocumentPicker.getDocumentAsync({
        // pas de '*/*' ici : sur web/Safari, un accept incluant '*/*' (ou tout
        // type image/vidéo) fait apparaître "Photothèque"/"Prendre une photo"
        // dans le menu, en plus de "Parcourir" — text/plain est inclus car
        // TuneMyMusic exporte un CSV que Safari classe en "Document texte"
        // (mimeType text/plain), pas text/csv (cf. modules/auth/csv.ts, capture
        // fournie par l'utilisateur)
        type: ['text/csv', 'text/comma-separated-values', 'application/vnd.ms-excel', 'text/plain'],
        copyToCacheDirectory: true,
    });

    if (result.canceled || !result.assets?.[0]) return null;

    const asset = result.assets[0];
    // asset.size est optionnel (absent sur certaines plateformes/certains
    // fournisseurs) : on ne bloque que quand on sait avec certitude que la
    // limite est dépassée, jamais par défaut faute d'info
    if (typeof asset.size === 'number' && asset.size > MAX_CSV_FILE_SIZE_BYTES) {
        throw new Error('Ce fichier est trop volumineux (limite : 20 Mo)');
    }

    const content = await readFileContent(asset);
    return parseCsvTracks(content);
};
