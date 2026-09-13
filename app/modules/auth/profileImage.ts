import * as ImagePicker from 'expo-image-picker';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

const AVATAR_SIZE = 80;

// ouvre le sélecteur de photo natif, redimensionne en 80x80 (taille des
// avatars) et renvoie une data URI base64. contrairement à une uri locale
// (file://, blob:), une data URI reste affichable par les autres joueurs une
// fois envoyée par socket, sans besoin d'un endpoint d'upload à part.
export const pickAndResizeProfileImage = async (): Promise<string | null> => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return null;

    const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 1,
    });

    if (result.canceled || !result.assets?.[0]) return null;

    const context = ImageManipulator.manipulate(result.assets[0].uri);
    const rendered = await context.resize({ width: AVATAR_SIZE, height: AVATAR_SIZE }).renderAsync();
    const saved = await rendered.saveAsync({ format: SaveFormat.JPEG, compress: 0.8, base64: true });

    if (!saved.base64) return null;
    return `data:image/jpeg;base64,${saved.base64}`;
};
