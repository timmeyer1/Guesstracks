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

// curseur système (Liquid Glass sur iOS, Material sur Android), on stylise rien.
// Sur web ça retombe sur un rendu générique, pas de rendu système possible depuis une page.
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
