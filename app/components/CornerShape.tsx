// app/components/CornerShape.tsx
import React from 'react';
import { Image, Platform, View, StyleProp, ImageStyle, DimensionValue } from 'react-native';

// ratio largeur/hauteur du visuel, dcp RN calcule la hauteur tout seul depuis la largeur
const SHAPE_ASPECT_RATIO = 877 / 1110;

export type CornerShapeProps = {
    /** Largeur du visuel : en % ça s'adapte à l'écran, en nombre c'est fixe. */
    size?: DimensionValue;
    /** Rotation en degrés (peut être négatif). */
    rotate?: number;
    /** Distance depuis le haut, en % ou en points. Négatif = ça déborde de l'écran. */
    top?: DimensionValue;
    /** Distance depuis le bas du conteneur (pourcentage ou points). */
    bottom?: DimensionValue;
    /** Distance depuis la gauche du conteneur (pourcentage ou points). */
    left?: DimensionValue;
    /** Distance depuis la droite du conteneur (pourcentage ou points). */
    right?: DimensionValue;
    /** Miroir horizontal (utile pour varier l'aspect du même visuel). */
    flipHorizontal?: boolean;
    /** Miroir vertical. */
    flipVertical?: boolean;
    opacity?: number;
    style?: StyleProp<ImageStyle>;
};

/**
 * Une forme violette décorative, à mettre dans les coins des écrans via
 * le prop `shapes` de ScreenLayout. En gros : `size` pour la taille,
 * `top/bottom/left/right` pour la placer, `rotate` pour la pivoter.
 * Préfère les pourcentages aux points fixes pour un rendu cohérent partout.
 */
export const CornerShape: React.FC<CornerShapeProps> = ({
    size = '45%',
    rotate = 0,
    top,
    bottom,
    left,
    right,
    flipHorizontal = false,
    flipVertical = false,
    opacity = 1,
    style,
}) => {
    const scaleX = flipHorizontal ? -1 : 1;
    const scaleY = flipVertical ? -1 : 1;

    return (
        <View
            pointerEvents="none"
            style={{
                // sur web/PWA, public/index.html réduit la hauteur de <html> pour
                // suivre window.visualViewport quand le clavier est ouvert (voir
                // ce fichier). Avec 'absolute', top/bottom en % se recalculaient
                // sur ce conteneur réduit, dcp les formes bougeaient à chaque
                // ouverture/fermeture du clavier. 'fixed' les ancre au vrai
                // viewport de mise en page, jamais réduit par le clavier sur iOS
                // (même principe que le bandeau du bas dans
                // manualTrackPicker.screen.tsx). Natif non concerné (pas de
                // clavier logiciel qui redimensionne la fenêtre).
                position: (Platform.OS === 'web' ? 'fixed' : 'absolute') as 'absolute',
                width: size,
                aspectRatio: SHAPE_ASPECT_RATIO,
                top,
                bottom,
                left,
                right,
                opacity,
                transform: [
                    { rotate: `${rotate}deg` },
                    { scaleX },
                    { scaleY },
                ],
            }}
        >
            <Image
                source={require('../images/shapes-purple.png')}
                resizeMode="contain"
                style={[{ width: '100%', height: '100%' }, style]}
            />
        </View>
    );
};
