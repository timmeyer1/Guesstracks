// Accepte soit un ID Deezer numérique brut, soit un lien de profil complet
// (ex: https://www.deezer.com/fr/profile/1687950, avec ou sans slash/paramètres
// de fin) et en extrait l'ID numérique. Utilisé par le lookup de profil public
// (cf. deezer.service.ts) tant que la création d'app OAuth Deezer est cassée
// côté développeur (app/modules/auth/deezer.ts reste l'implémentation OAuth,
// prête à être réactivée).
export const extractDeezerProfileId = (input: string): string | null => {
    const trimmed = input.trim();
    if (/^\d+$/.test(trimmed)) return trimmed;

    const match = trimmed.match(/profile\/(\d+)/);
    return match ? match[1] : null;
};
