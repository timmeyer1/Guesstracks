import Slider from "@react-native-community/slider"
import { COLORS } from "../../core/constants/colors.constants"

export type SettingsSliderProps = {
    min: number
    max: number
    step: number
    value: number
    onValueChange: (value: number) => void
    accentColor: string
}

// curseur système (UISlider/SeekBar), le même sur toutes les plateformes :
// adopte automatiquement le rendu du système (Liquid Glass sur iOS 26,
// Material sur Android) sans rien à styliser nous-mêmes. Sur web, cette lib
// retombe sur son propre rendu générique (pas de rendu système possible
// depuis une page : Liquid Glass est un matériau natif, inaccessible au DOM
// même dans Safari sur iPhone).
export const THUMB_SIZE = 28

export const SettingsSlider = ({ min, max, step, value, onValueChange, accentColor }: SettingsSliderProps) => {
    return (
        <Slider
            style={{ width: "100%", height: 40 }}
            minimumValue={min}
            maximumValue={max}
            step={step}
            value={value}
            onValueChange={onValueChange}
            minimumTrackTintColor={accentColor}
            maximumTrackTintColor={COLORS.offwhite}
            thumbTintColor={accentColor}
            thumbSize={THUMB_SIZE}
        />
    )
}
