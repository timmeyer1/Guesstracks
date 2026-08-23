import React, { useState, useEffect } from "react"
import { Modal, View, Text, TouchableOpacity, Pressable, ScrollView, Switch } from "react-native"
import Slider from "@react-native-community/slider"
import { GAME_MODES, TRACK_ALGORITHMS, DEFAULT_LOBBY_SETTINGS, LOBBY_LIMITS } from "../../core/constants/lobby.constants"
import { COLORS } from "../../core/constants/colors.constants"
import { GameMode, PhaseSpeed, TrackAlgorithm } from "../../core/types"
import { SectionTitle } from "../SectionTitle"
import { CustomButton } from "../Button"

export type LobbySettings = {
    gameMode: GameMode
    rounds: number
    phaseSpeed: PhaseSpeed
    manualAdvance: boolean
    trackAlgorithm: TrackAlgorithm
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
    const [trackAlgorithm, setTrackAlgorithm] = useState<TrackAlgorithm>(
        initialSettings?.trackAlgorithm ?? DEFAULT_LOBBY_SETTINGS.trackAlgorithm
    )

    // couleur d'accent des réglages (curseurs, contours, switch...) : celle du
    // mode de jeu actuellement sélectionné (violet guesstracks / orange
    // blindtest, cf. colors.constants.ts) plutôt qu'une couleur fixe, pour que
    // toute la modale se re-teinte instantanément quand on change de mode —
    // s'étend automatiquement à un futur mode tant qu'il a une entrée dans COLORS
    const accentColor = COLORS[gameMode]

    // synchro avec les paramètres initiaux quand la modal s'ouvre
    useEffect(() => {
        if (visible && initialSettings) {
            setGameMode(initialSettings.gameMode)
            setRounds(initialSettings.rounds)
            setPhaseSpeed(initialSettings.phaseSpeed)
            setManualAdvance(initialSettings.manualAdvance)
            setTrackAlgorithm(initialSettings.trackAlgorithm)
        }
    }, [visible, initialSettings])

    const handleConfirm = () => {
        onConfirm({ gameMode, rounds, phaseSpeed, manualAdvance, trackAlgorithm })
        onClose()
    }

    const handleClose = () => {
        // reset aux valeurs initiales ou par défaut
        if (initialSettings) {
            setGameMode(initialSettings.gameMode)
            setRounds(initialSettings.rounds)
            setPhaseSpeed(initialSettings.phaseSpeed)
            setManualAdvance(initialSettings.manualAdvance)
            setTrackAlgorithm(initialSettings.trackAlgorithm)
        } else {
            setGameMode(DEFAULT_LOBBY_SETTINGS.gameMode)
            setRounds(DEFAULT_LOBBY_SETTINGS.rounds)
            setPhaseSpeed(DEFAULT_LOBBY_SETTINGS.phaseSpeed)
            setManualAdvance(DEFAULT_LOBBY_SETTINGS.manualAdvance)
            setTrackAlgorithm(DEFAULT_LOBBY_SETTINGS.trackAlgorithm)
        }
        onClose()
    }

    return (
        <Modal transparent visible={visible} animationType="fade" onRequestClose={handleClose}>
            <Pressable
                className="flex-1 bg-black/60 justify-center items-center px-8"
                onPress={handleClose}
            >
                <Pressable className="bg-white w-full rounded-3xl p-6" style={{ maxHeight: '85%' }}>
                    <SectionTitle
                        title={mode === "create" ? "Créer une partie" : "Paramètres"}
                        subtitle={mode === "create" ? "Configure ta partie !" : "Modifie les règles"}
                        align="center"
                        titleSize="md"
                        subtitleSize="sm"
                        className="mb-6"
                    />

                    <ScrollView className="mb-6" showsVerticalScrollIndicator={false}>
                        <View className="mb-6">
                            <SectionTitle title="Mode de jeu" align="center" titleSize="sm" className="mb-3" />
                            <View className="flex-row gap-2">
                                {(Object.keys(GAME_MODES) as GameMode[]).map((mode) => {
                                    const selected = gameMode === mode
                                    const modeColor = COLORS[mode]
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
                                            <Text className="text-2xl mb-1">{GAME_MODES[mode].icon}</Text>
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
                            <View className="bg-offwhite rounded-full p-1">
                                <Slider
                                    style={{ width: "100%", height: 40 }}
                                    minimumValue={LOBBY_LIMITS.MIN_ROUNDS}
                                    maximumValue={LOBBY_LIMITS.MAX_ROUNDS}
                                    step={LOBBY_LIMITS.ROUNDS_STEP}
                                    value={rounds}
                                    onValueChange={setRounds}
                                    minimumTrackTintColor={accentColor}
                                    maximumTrackTintColor="transparent"
                                    thumbTintColor={accentColor}
                                />
                            </View>
                            <View className="flex-row justify-between mt-2">
                                <Text className="text-darkgray text-xs">{LOBBY_LIMITS.MIN_ROUNDS}</Text>
                                <Text className="text-darkgray text-xs">{LOBBY_LIMITS.MAX_ROUNDS}</Text>
                            </View>
                        </View>

                        <View className="mb-4">
                            <SectionTitle
                                title={`Vitesse des phases : ${phaseSpeed}s`}
                                align="center"
                                titleSize="sm"
                                className="mb-3"
                            />
                            <View className="bg-offwhite rounded-full p-1">
                                <Slider
                                    style={{ width: "100%", height: 40 }}
                                    minimumValue={LOBBY_LIMITS.MIN_PHASE_SPEED}
                                    maximumValue={LOBBY_LIMITS.MAX_PHASE_SPEED}
                                    step={LOBBY_LIMITS.PHASE_SPEED_STEP}
                                    value={phaseSpeed}
                                    onValueChange={setPhaseSpeed}
                                    minimumTrackTintColor={accentColor}
                                    maximumTrackTintColor="transparent"
                                    thumbTintColor={accentColor}
                                />
                            </View>
                            <View className="flex-row justify-between mt-2">
                                <Text className="text-darkgray text-xs">{LOBBY_LIMITS.MIN_PHASE_SPEED}s</Text>
                                <Text className="text-darkgray text-xs">{LOBBY_LIMITS.MAX_PHASE_SPEED}s</Text>
                            </View>
                        </View>

                        {/* spécifique au blindtest : détermine comment les titres des
                            manches sont choisis (cf. TRACK_ALGORITHMS) — n'a aucun effet
                            en guesstracks (le titre y est toujours affiché, jamais deviné),
                            donc masqué pour ne pas exposer un réglage sans effet */}
                        {gameMode === 'blindtest' && (
                            <View className="mb-6">
                                <SectionTitle title="Choix des titres" align="center" titleSize="sm" className="mb-3" />
                                <View className="gap-2">
                                    {(Object.keys(TRACK_ALGORITHMS) as TrackAlgorithm[]).map((algorithm) => {
                                        const selected = trackAlgorithm === algorithm
                                        return (
                                            <TouchableOpacity
                                                key={algorithm}
                                                className="rounded-2xl px-4 py-3"
                                                style={{
                                                    backgroundColor: selected ? accentColor + '15' : COLORS.offwhite,
                                                    borderWidth: 1.5,
                                                    borderColor: selected ? accentColor : 'transparent',
                                                }}
                                                onPress={() => setTrackAlgorithm(algorithm)}
                                            >
                                                <Text className="font-bold text-black text-sm">
                                                    {TRACK_ALGORITHMS[algorithm].label}
                                                </Text>
                                                <Text className="text-darkgray text-xs mt-0.5">
                                                    {TRACK_ALGORITHMS[algorithm].description}
                                                </Text>
                                            </TouchableOpacity>
                                        )
                                    })}
                                </View>
                            </View>
                        )}

                        <View className="mb-2 flex-row items-center justify-between bg-offwhite rounded-2xl px-4 py-3">
                            <View className="flex-1 mr-3">
                                <Text className="text-black font-semibold text-sm">
                                    Manche automatique
                                </Text>
                            </View>
                            <Switch
                                value={!manualAdvance}
                                onValueChange={(value) => setManualAdvance(!value)}
                                trackColor={{ true: accentColor }}
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
                </Pressable>
            </Pressable>
        </Modal>
    )
}
