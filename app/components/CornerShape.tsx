// app/components/CornerShape.tsx
import React from 'react';
import { Image, View, StyleProp, ImageStyle, DimensionValue } from 'react-native';

// Ratio largeur/hauteur du visuel source (app/images/shapes-purple.png).
// RN calcule la hauteur tout seul à partir de la largeur (voir aspectRatio ci-dessous),
// donc ça marche aussi bien avec une largeur en points qu'en pourcentage.
const SHAPE_ASPECT_RATIO = 877 / 1110;

export type CornerShapeProps = {
    /**
     * Largeur du visuel. Un pourcentage ("45%") se recalcule automatiquement selon la
     * taille de l'écran (recommandé pour un rendu cohérent sur tous les appareils) ;
     * un nombre (220) donne une taille fixe en points, identique sur tous les écrans.
     */
    size?: DimensionValue;
    /** Rotation en degrés (peut être négatif). */
    rotate?: number;
    /**
     * Distance depuis le haut du conteneur : pourcentage ("−8%") ou points (−65).
     * Une valeur négative fait déborder la forme hors de l'écran (comme sur la maquette).
     */
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
 * Une des formes violettes décoratives (voir app/images/shapes-purple.png),
 * à placer dans les coins des écrans via `ScreenLayout`'s `shapes` prop.
 *
 * Pour l'agrandir : augmente `size` (ex: "45%" → "55%").
 * Pour la déplacer : ajuste `top`/`bottom`/`left`/`right` (des valeurs négatives
 * la font déborder hors de l'écran, comme dans la maquette).
 * Pour la faire pivoter : change `rotate` (en degrés).
 *
 * Utilise des pourcentages (plutôt que des points fixes) pour que la forme garde
 * la même taille et position relatives sur un petit téléphone comme sur une tablette.
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
                position: 'absolute',
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
