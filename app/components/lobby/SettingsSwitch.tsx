import { useEffect } from "react"
import { Platform, Pressable, Switch } from "react-native"
import Animated, { useSharedValue, useAnimatedStyle, withTiming } from "react-native-reanimated"

export type SettingsSwitchProps = {
    value: boolean
    onValueChange: (value: boolean) => void
    accentColor: string
    thumbColor: string
}

const TRACK_WIDTH = 51
const TRACK_HEIGHT = 31
const TRACK_RADIUS = TRACK_HEIGHT / 2
const PADDING = 2
const THUMB_SIZE = TRACK_HEIGHT - PADDING * 2
const THUMB_TRAVEL = TRACK_WIDTH - PADDING * 2 - THUMB_SIZE

// le Switch de react-native-web gère mal trackColor/thumbColor (couleurs par
// défaut du navigateur), dcp on a fait un toggle maison juste pour le web.
const WebSwitch = ({ value, onValueChange, accentColor, thumbColor }: SettingsSwitchProps) => {
    const progress = useSharedValue(value ? 1 : 0)

    useEffect(() => {
        progress.value = withTiming(value ? 1 : 0, { duration: 150 })
    }, [value, progress])

    const thumbStyle = useAnimatedStyle(() => ({
        transform: [{ translateX: progress.value * THUMB_TRAVEL }],
    }))

    return (
        <Pressable
            onPress={() => onValueChange(!value)}
            accessibilityRole="switch"
            accessibilityState={{ checked: value }}
            style={{
                width: TRACK_WIDTH,
                height: TRACK_HEIGHT,
                borderRadius: TRACK_RADIUS,
                padding: PADDING,
                backgroundColor: value ? accentColor : "#D9D9D9",
            }}
        >
            <Animated.View
                style={[
                    { width: THUMB_SIZE, height: THUMB_SIZE, borderRadius: THUMB_SIZE / 2, backgroundColor: thumbColor },
                    thumbStyle,
                ]}
            />
        </Pressable>
    )
}

// switch système sur natif, toggle maison sur web (WebSwitch au-dessus)
export const SettingsSwitch = (props: SettingsSwitchProps) => {
    if (Platform.OS === "web") {
        return <WebSwitch {...props} />
    }

    return (
        <Switch
            value={props.value}
            onValueChange={props.onValueChange}
            trackColor={{ true: props.accentColor }}
            thumbColor={props.thumbColor}
        />
    )
}
