// accepte soit un ID Deezer brut, soit un lien de profil complet (ex:
// deezer.com/fr/profile/1687950) et en extrait l'ID. utilisé pour le lookup
// public tant que la création d'app OAuth Deezer est cassée côté Deezer —
// l'implémentation OAuth (auth/deezer.ts) reste prête à être réactivée.
export const extractDeezerProfileId = (input: string): string | null => {
    const trimmed = input.trim();
    if (/^\d+$/.test(trimmed)) return trimmed;

    const match = trimmed.match(/profile\/(\d+)/);
    return match ? match[1] : null;
};
