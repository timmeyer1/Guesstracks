// app/components/CornerShape.tsx
import React from 'react';
import { Image, View, StyleProp, ImageStyle, DimensionValue } from 'react-native';

// Ratio largeur/hauteur du visuel source (app/images/shapes-purple.png).
// On s'en sert pour calculer la hauteur automatiquement à partir de la largeur.
const SHAPE_RATIO = 1110 / 877;

export type CornerShapeProps = {
    /** Largeur du visuel, en points. La hauteur suit automatiquement le ratio de l'image. */
    size?: number;
    /** Rotation en degrés (peut être négatif). */
    rotate?: number;
    /** Distance depuis le haut du conteneur : en points, ou en pourcentage ("45%") — peut être négative pour faire déborder la forme hors de l'écran. */
    top?: DimensionValue;
    /** Distance depuis le bas du conteneur (points ou pourcentage). */
    bottom?: DimensionValue;
    /** Distance depuis la gauche du conteneur (points ou pourcentage). */
    left?: DimensionValue;
    /** Distance depuis la droite du conteneur (points ou pourcentage). */
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
 * Pour l'agrandir : augmente `size`.
 * Pour la déplacer : ajuste `top`/`bottom`/`left`/`right` (des valeurs négatives
 * la font déborder hors de l'écran, comme dans la maquette).
 * Pour la faire pivoter : change `rotate` (en degrés).
 */
export const CornerShape: React.FC<CornerShapeProps> = ({
    size = 220,
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
                height: size * SHAPE_RATIO,
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
