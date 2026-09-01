import { useEffect } from "react"
import { View, LayoutChangeEvent } from "react-native"
import { Gesture, GestureDetector } from "react-native-gesture-handler"
import Animated, { useSharedValue, useAnimatedStyle, runOnJS } from "react-native-reanimated"

export type SettingsSliderProps = {
    min: number
    max: number
    step: number
    value: number
    onValueChange: (value: number) => void
    accentColor: string
}

export const THUMB_SIZE = 28
// padding autour de la piste (cf. className "p-1" plus bas) : extrait en
// constante pour que StepRuler (LobbySettingsModal.tsx) puisse aligner ses
// graduations exactement sur la course réelle du curseur
export const SLIDER_PADDING = 4
const TRACK_HEIGHT = 40
const LINE_HEIGHT = 6

// aimante une position brute (0..1 le long de la piste) au palier le plus
// proche : les paliers sont uniformément espacés (contrairement à l'ancien
// bucketToStep basé sur le <Slider> natif, ici la position 0..1 EST la
// valeur, pas besoin de traitement asymétrique aux extrémités)
const snapToStep = (fraction: number, min: number, max: number, step: number) => {
    "worklet"
    const stepCount = Math.round((max - min) / step)
    const snappedStep = Math.round(fraction * stepCount)
    return min + snappedStep * step
}

// slider "maison" (Pan gesture + Reanimated) plutôt que
// @react-native-community/slider : sa prop `step` n'aimante le curseur
// qu'à la valeur affichée/relâchée, jamais visuellement pendant le glissé
// (constaté sur Expo Go) — en pilotant nous-mêmes la position du curseur à
// chaque frame du geste, on peut la faire sauter pile sur chaque palier en
// temps réel, sans dépendre du comportement natif de la lib.
export const SettingsSlider = ({ min, max, step, value, onValueChange, accentColor }: SettingsSliderProps) => {
    const trackWidth = useSharedValue(0)
    const fraction = useSharedValue((value - min) / (max - min))
    const lastValue = useSharedValue(value)

    // resynchro si la valeur change depuis l'extérieur (reset des réglages,
    // valeur initiale reçue après ouverture...) — sans conflit avec un glissé
    // en cours puisque seul le geste écrit dans `fraction` par ailleurs
    useEffect(() => {
        fraction.value = (value - min) / (max - min)
        lastValue.value = value
    }, [value, min, max, fraction, lastValue])

    const updateFromX = (x: number) => {
        "worklet"
        const travel = Math.max(1, trackWidth.value - THUMB_SIZE)
        const raw = Math.min(1, Math.max(0, (x - THUMB_SIZE / 2) / travel))
        const snapped = snapToStep(raw, min, max, step)
        fraction.value = (snapped - min) / (max - min)
        if (snapped !== lastValue.value) {
            lastValue.value = snapped
            runOnJS(onValueChange)(snapped)
        }
    }

    const pan = Gesture.Pan()
        .onBegin((e) => updateFromX(e.x))
        .onUpdate((e) => updateFromX(e.x))

    const onLayout = (e: LayoutChangeEvent) => {
        trackWidth.value = e.nativeEvent.layout.width
    }

    const fillStyle = useAnimatedStyle(() => {
        const travel = Math.max(1, trackWidth.value - THUMB_SIZE)
        return { width: fraction.value * travel + THUMB_SIZE / 2 }
    })

    const thumbStyle = useAnimatedStyle(() => {
        const travel = Math.max(1, trackWidth.value - THUMB_SIZE)
        return { left: fraction.value * travel }
    })

    return (
        <View className="bg-offwhite rounded-full" style={{ padding: SLIDER_PADDING }}>
            <GestureDetector gesture={pan}>
                <View onLayout={onLayout} style={{ height: TRACK_HEIGHT, justifyContent: "center" }}>
                    <View
                        className="rounded-full bg-white/50"
                        style={{ height: LINE_HEIGHT }}
                    />
                    <Animated.View
                        style={[
                            { backgroundColor: accentColor, height: LINE_HEIGHT, top: (TRACK_HEIGHT - LINE_HEIGHT) / 2 },
                            fillStyle,
                        ]}
                        className="absolute left-0 rounded-full"
                    />
                    <Animated.View
                        style={[
                            {
                                width: THUMB_SIZE,
                                height: THUMB_SIZE,
                                top: (TRACK_HEIGHT - THUMB_SIZE) / 2,
                                backgroundColor: "white",
                                borderWidth: 2,
                                borderColor: accentColor,
                            },
                            thumbStyle,
                        ]}
                        className="absolute rounded-full"
                    />
                </View>
            </GestureDetector>
        </View>
    )
}
