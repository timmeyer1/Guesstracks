import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import { Platform } from 'react-native';
import Papa from 'papaparse';
import type { TrackType } from '../../core/types';

// les noms de colonnes CSV changent selon la source (Spotify, Deezer...),
// dcp on matche plusieurs variantes usuelles au lieu d'exiger un format fixe
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

// mêmes limites que côté serveur, en gros ça coupe court à un fichier
// corrompu ou abusif avant même d'essayer de l'envoyer au lobby
const MAX_TRACKS = 5000;
const MAX_FIELD_LENGTH = 300;

const truncateField = (value: string) => value.slice(0, MAX_FIELD_LENGTH);

// pas besoin de token, le serveur retrouve l'extrait audio juste avec titre+artiste
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
    // au-delà de MAX_TRACKS on ignore le reste et truncated prévient
    // l'utilisateur. TuneMyMusic exporte les titres les plus récents en
    // premier, dcp garder les MAX_TRACKS premières lignes garde bien les
    // plus récents — touche pas à cet ordre sans revérifier ce point.
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
    // sur web on a direct l'objet File du navigateur, sur natif on lit via l'uri en cache
    if (Platform.OS === 'web' && asset.file) {
        return await asset.file.text();
    }
    return await new File(asset.uri).text();
};

// une vraie bibliothèque dépasse jamais ça, dcp au-delà c'est sûrement un fichier corrompu ou abusif
const MAX_CSV_FILE_SIZE_BYTES = 20 * 1024 * 1024; // 20 Mo

// ouvre le sélecteur de fichier natif (adapté Android/iPhone/PC) et renvoie
// les titres importés, ou null si l'utilisateur a annulé
export const importTracksFromCsv = async (): Promise<CsvImportResult | null> => {
    const result = await DocumentPicker.getDocumentAsync({
        // pas de '*/*' ici : sur Safari web ça fait apparaître "Photothèque"/
        // "Prendre une photo" en plus de "Parcourir". text/plain est inclus
        // car Safari classe le CSV exporté par TuneMyMusic en "document
        // texte" (mimeType text/plain), pas text/csv.
        type: ['text/csv', 'text/comma-separated-values', 'application/vnd.ms-excel', 'text/plain'],
        copyToCacheDirectory: true,
    });

    if (result.canceled || !result.assets?.[0]) return null;

    const asset = result.assets[0];
    // asset.size est parfois absent, dcp on bloque que si on est sûr que la limite est dépassée
    if (typeof asset.size === 'number' && asset.size > MAX_CSV_FILE_SIZE_BYTES) {
        throw new Error('Ce fichier est trop volumineux (limite : 20 Mo)');
    }

    const content = await readFileContent(asset);
    return parseCsvTracks(content);
};
