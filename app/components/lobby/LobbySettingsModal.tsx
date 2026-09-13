import React, { useState, useEffect, useRef } from "react"
import { Modal, View, Text, TouchableOpacity, Pressable } from "react-native"
// ScrollView de gesture-handler plutôt que celle de react-native, en gros
// pour mieux gérer les gestes verticaux/horizontaux en même temps sur Android
import { ScrollView, GestureHandlerRootView } from "react-native-gesture-handler"
import { GAME_MODES, DEFAULT_LOBBY_SETTINGS, LOBBY_LIMITS } from "../../core/constants/lobby.constants"
import { COLORS } from "../../core/constants/colors.constants"
import { GameMode, PhaseSpeed } from "../../core/types"
import { SectionTitle } from "../SectionTitle"
import { CustomButton } from "../Button"
import { GAME_MODE_ICONS } from "./GameModeCard"
import { SettingsSlider, THUMB_SIZE } from "./SettingsSlider"
import { SettingsSwitch } from "./SettingsSwitch"

// tous les paliers atteignables du curseur (ex. 5, 10, 15, 20, 25, 30)
const stepValues = (min: number, max: number, step: number) => {
    const values: number[] = []
    for (let value = min; value <= max; value += step) values.push(value)
    return values
}

// largeur de chaque étiquette pour bien la centrer, suffisant pour "5" à "30s"
const TICK_LABEL_WIDTH = 28

// règle graduée sous le curseur (un trait + un nombre par palier). Alignée sur
// la vraie course du curseur (pas la largeur totale), sinon les graduations
// extrêmes paraissent décalées vers l'extérieur.
type StepRulerProps = {
    min: number
    max: number
    step: number
    suffix?: string
}

const StepRuler = ({ min, max, step, suffix = "" }: StepRulerProps) => {
    const [width, setWidth] = useState(0)
    const values = stepValues(min, max, step)
    const inset = THUMB_SIZE / 2
    const travel = Math.max(1, width - inset * 2)

    return (
        <View
            className="mt-2"
            style={{ height: 24 }}
            onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
        >
            {width > 0 && values.map((value, index) => {
                const fraction = values.length > 1 ? index / (values.length - 1) : 0
                const center = inset + fraction * travel
                return (
                    <View
                        key={value}
                        className="absolute items-center"
                        style={{ left: center - TICK_LABEL_WIDTH / 2, width: TICK_LABEL_WIDTH }}
                    >
                        <View className="w-px h-1.5 bg-darkgray mb-1" />
                        <Text className="text-darkgray text-xs">{value}{suffix}</Text>
                    </View>
                )
            })}
        </View>
    )
}

export type LobbySettings = {
    gameMode: GameMode
    rounds: number
    phaseSpeed: PhaseSpeed
    manualAdvance: boolean
}

type LobbySettingsModalProps = {
    visible: boolean
    mode: "create" | "edit"
    onClose: () => void
    onConfirm: (settings: LobbySettings) => void
    initialSettings?: LobbySettings
}

export const LobbySettingsModal = ({
    visible,
    mode,
    onClose,
    onConfirm,
    initialSettings,
}: LobbySettingsModalProps) => {
    const [gameMode, setGameMode] = useState<GameMode>(
        initialSettings?.gameMode ?? DEFAULT_LOBBY_SETTINGS.gameMode
    )
    const [rounds, setRounds] = useState(
        initialSettings?.rounds ?? DEFAULT_LOBBY_SETTINGS.rounds
    )
    const [phaseSpeed, setPhaseSpeed] = useState<PhaseSpeed>(
        initialSettings?.phaseSpeed ?? DEFAULT_LOBBY_SETTINGS.phaseSpeed
    )
    const [manualAdvance, setManualAdvance] = useState(
        initialSettings?.manualAdvance ?? DEFAULT_LOBBY_SETTINGS.manualAdvance
    )

    // scroll activé que si le contenu dépasse vraiment, sinon ça bougeait
    // pour rien même quand tout rentrait déjà à l'écran
    const [scrollViewHeight, setScrollViewHeight] = useState(0)
    const [contentHeight, setContentHeight] = useState(0)
    const scrollEnabled = contentHeight > scrollViewHeight

    // couleur d'accent des réglages basée sur le mode de jeu choisi (violet ou
    // orange), dcp toute la modale se re-teinte direct quand on change de mode
    const accentColor = COLORS[gameMode]

    // resynchro les réglages que quand la modale s'ouvre (fermée → ouverte),
    // pas à chaque update socket du lobby, sinon un curseur en train d'être
    // bougé revenait direct à sa valeur serveur
    const wasVisible = useRef(false)
    useEffect(() => {
        if (visible && !wasVisible.current && initialSettings) {
            setGameMode(initialSettings.gameMode)
            setRounds(initialSettings.rounds)
            setPhaseSpeed(initialSettings.phaseSpeed)
            setManualAdvance(initialSettings.manualAdvance)
        }
        wasVisible.current = visible
    }, [visible, initialSettings])

    const handleConfirm = () => {
        onConfirm({ gameMode, rounds, phaseSpeed, manualAdvance })
        onClose()
    }

    const handleClose = () => {
        // reset aux valeurs initiales ou par défaut
        if (initialSettings) {
            setGameMode(initialSettings.gameMode)
            setRounds(initialSettings.rounds)
            setPhaseSpeed(initialSettings.phaseSpeed)
            setManualAdvance(initialSettings.manualAdvance)
        } else {
            setGameMode(DEFAULT_LOBBY_SETTINGS.gameMode)
            setRounds(DEFAULT_LOBBY_SETTINGS.rounds)
            setPhaseSpeed(DEFAULT_LOBBY_SETTINGS.phaseSpeed)
            setManualAdvance(DEFAULT_LOBBY_SETTINGS.manualAdvance)
        }
        onClose()
    }

    return (
        <Modal transparent visible={visible} animationType="fade" onRequestClose={handleClose}>
            {/* Modal ouvre sa propre fenêtre, hors de portée du GestureHandlerRootView
                de App.tsx, dcp les gestes marchaient pas dans la modale sur Android.
                Faut son propre GestureHandlerRootView ici, c'est un piège connu de la lib. */}
            <GestureHandlerRootView style={{ flex: 1 }}>
                {/* backdrop en sibling de la carte, pas en Pressable ancêtre : sinon
                    ça capte le geste dès qu'on touche du vide et le scroll marche
                    plus que sur les boutons/curseurs, jamais entre eux */}
                <Pressable
                    className="absolute top-0 left-0 right-0 bottom-0 bg-black/60"
                    onPress={handleClose}
                />
                <View
                    className="flex-1 justify-center items-center px-8"
                    pointerEvents="box-none"
                >
                    <View className="bg-white w-full rounded-3xl p-6" style={{ maxHeight: '85%' }}>
                    <SectionTitle
                        title={mode === "create" ? "Créer une partie" : "Paramètres"}
                        subtitle={mode === "create" ? "Configure ta partie !" : "Modifie les règles"}
                        align="center"
                        titleSize="md"
                        subtitleSize="sm"
                        className="mb-6"
                    />

                    <ScrollView
                        className="mb-6"
                        showsVerticalScrollIndicator={false}
                        scrollEnabled={scrollEnabled}
                        onLayout={(e) => setScrollViewHeight(e.nativeEvent.layout.height)}
                        onContentSizeChange={(_, height) => setContentHeight(height)}
                    >
                        <View className="mb-6">
                            <SectionTitle title="Mode de jeu" align="center" titleSize="sm" className="mb-3" />
                            <View className="flex-row gap-2">
                                {(Object.keys(GAME_MODES) as GameMode[]).map((mode) => {
                                    const selected = gameMode === mode
                                    const modeColor = COLORS[mode]
                                    const Icon = GAME_MODE_ICONS[mode]
                                    return (
                                        <TouchableOpacity
                                            key={mode}
                                            className="flex-1 py-3 rounded-2xl items-center"
                                            style={{
                                                backgroundColor: selected ? modeColor + '15' : COLORS.offwhite,
                                                borderWidth: 1.5,
                                                borderColor: selected ? modeColor : 'transparent',
                                            }}
                                            onPress={() => setGameMode(mode)}
                                        >
                                            <Icon size={24} color={selected ? modeColor : COLORS.darkgray} style={{ marginBottom: 4 }} />
                                            <Text className="font-bold text-black">
                                                {GAME_MODES[mode].label}
                                            </Text>
                                        </TouchableOpacity>
                                    )
                                })}
                            </View>
                        </View>

                        <View className="mb-6">
                            <SectionTitle
                                title={`Nombre de manches : ${rounds}`}
                                align="center"
                                titleSize="sm"
                                className="mb-3"
                            />
                            <SettingsSlider
                                min={LOBBY_LIMITS.MIN_ROUNDS}
                                max={LOBBY_LIMITS.MAX_ROUNDS}
                                step={LOBBY_LIMITS.ROUNDS_STEP}
                                value={rounds}
                                onValueChange={setRounds}
                                accentColor={accentColor}
                            />
                            <StepRuler
                                min={LOBBY_LIMITS.MIN_ROUNDS}
                                max={LOBBY_LIMITS.MAX_ROUNDS}
                                step={LOBBY_LIMITS.ROUNDS_STEP}
                            />
                        </View>

                        <View className="mb-4">
                            <SectionTitle
                                title={`Vitesse des phases : ${phaseSpeed}s`}
                                align="center"
                                titleSize="sm"
                                className="mb-3"
                            />
                            <SettingsSlider
                                min={LOBBY_LIMITS.MIN_PHASE_SPEED}
                                max={LOBBY_LIMITS.MAX_PHASE_SPEED}
                                step={LOBBY_LIMITS.PHASE_SPEED_STEP}
                                value={phaseSpeed}
                                onValueChange={setPhaseSpeed}
                                accentColor={accentColor}
                            />
                            <StepRuler
                                min={LOBBY_LIMITS.MIN_PHASE_SPEED}
                                max={LOBBY_LIMITS.MAX_PHASE_SPEED}
                                step={LOBBY_LIMITS.PHASE_SPEED_STEP}
                                suffix="s"
                            />
                        </View>

                        <View className="mb-2 flex-row items-center justify-between bg-offwhite rounded-2xl px-4 py-3">
                            <View className="flex-1 mr-3">
                                <Text className="text-black font-semibold text-sm">
                                    Manche automatique
                                </Text>
                            </View>
                            <SettingsSwitch
                                value={!manualAdvance}
                                onValueChange={(value) => setManualAdvance(!value)}
                                accentColor={accentColor}
                                thumbColor={COLORS.white}
                            />
                        </View>
                    </ScrollView>

                    <View className="flex-row gap-2.5 w-full">
                        <View className="flex-1">
                            <CustomButton name="Annuler" onPress={handleClose} variant="dark" />
                        </View>

                        <View className="flex-1">
                            <CustomButton
                                name="Go"
                                onPress={handleConfirm}
                                variant="white"
                            />
                        </View>
                    </View>
                </View>
            </View>
            </GestureHandlerRootView>
        </Modal>
    )
}
