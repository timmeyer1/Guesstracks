import React, { useState, useEffect } from "react"
import { Modal, View, Text, TouchableOpacity, Pressable, ScrollView } from "react-native"
import Slider from "@react-native-community/slider"
import { GAME_MODES, PHASE_SPEEDS, DEFAULT_LOBBY_SETTINGS, LOBBY_LIMITS } from "../../core/constants/lobby.constants"
import { GameMode, PhaseSpeed } from "../../core/types"

export type LobbySettings = {
    gameMode: GameMode
    rounds: number
    phaseSpeed: PhaseSpeed
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

    // synchro avec les paramètres initiaux quand la modal s'ouvre
    useEffect(() => {
        if (visible && initialSettings) {
            setGameMode(initialSettings.gameMode)
            setRounds(initialSettings.rounds)
            setPhaseSpeed(initialSettings.phaseSpeed)
        }
    }, [visible, initialSettings])

    const handleConfirm = () => {
        onConfirm({ gameMode, rounds, phaseSpeed })
        onClose()
    }

    const handleClose = () => {
        // reset aux valeurs initiales ou par défaut
        if (initialSettings) {
            setGameMode(initialSettings.gameMode)
            setRounds(initialSettings.rounds)
            setPhaseSpeed(initialSettings.phaseSpeed)
        } else {
            setGameMode(DEFAULT_LOBBY_SETTINGS.gameMode)
            setRounds(DEFAULT_LOBBY_SETTINGS.rounds)
            setPhaseSpeed(DEFAULT_LOBBY_SETTINGS.phaseSpeed)
        }
        onClose()
    }

    return (
        <Modal transparent visible={visible} animationType="fade" onRequestClose={handleClose}>
            <Pressable
                className="flex-1 bg-black/60 justify-center items-center"
                onPress={handleClose}
            >
                <Pressable className="bg-[#1a1a1a] w-4/5 rounded-3xl p-6">
                    <Text className="text-white text-2xl font-bold mb-2 text-center">
                        {mode === "create" ? "Créer une partie" : "Paramètres"}
                    </Text>

                    <Text className="text-gray-400 text-sm mb-6 text-center">
                        {mode === "create" ? "Configure ta partie !" : "Modifie les règles"}
                    </Text>

                    <ScrollView className="mb-6">
                        <View className="mb-6">
                            <Text className="text-white font-semibold mb-3 text-center">
                                Mode de jeu
                            </Text>
                            <View className="flex-row gap-2">
                                {(Object.keys(GAME_MODES) as GameMode[]).map((mode) => (
                                    <TouchableOpacity
                                        key={mode}
                                        className={`flex-1 py-3 rounded-xl items-center ${gameMode === mode ? "bg-primary-start" : "bg-zinc-800"
                                            }`}
                                        onPress={() => setGameMode(mode)}
                                    >
                                        <Text className="text-2xl mb-1">{GAME_MODES[mode].icon}</Text>
                                        <Text className="text-white font-bold">{GAME_MODES[mode].label}</Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </View>

                        <View className="mb-6">
                            <Text className="text-white font-semibold mb-3 text-center">
                                Nombre de manches : {rounds}
                            </Text>
                            <View className="bg-zinc-800 rounded-full p-1">
                                <Slider
                                    style={{ width: "100%", height: 40 }}
                                    minimumValue={LOBBY_LIMITS.MIN_ROUNDS}
                                    maximumValue={LOBBY_LIMITS.MAX_ROUNDS}
                                    step={1}
                                    value={rounds}
                                    onValueChange={setRounds}
                                    minimumTrackTintColor="#9622e0"
                                    maximumTrackTintColor="transparent"
                                    thumbTintColor="#9622e0"
                                />
                            </View>
                            <View className="flex-row justify-between mt-2">
                                <Text className="text-gray-400 text-xs">{LOBBY_LIMITS.MIN_ROUNDS}</Text>
                                <Text className="text-gray-400 text-xs">{LOBBY_LIMITS.MAX_ROUNDS}</Text>
                            </View>
                        </View>

                        <View className="mb-4">
                            <Text className="text-white font-semibold mb-3 text-center">
                                Vitesse des phases
                            </Text>
                            <View className="flex-row gap-2">
                                {(Object.keys(PHASE_SPEEDS) as PhaseSpeed[]).map((speed) => (
                                    <TouchableOpacity
                                        key={speed}
                                        className={`flex-1 py-3 rounded-xl items-center ${phaseSpeed === speed ? "bg-primary-start" : "bg-zinc-800"
                                            }`}
                                        onPress={() => setPhaseSpeed(speed)}
                                    >
                                        <Text className="text-white font-bold">{PHASE_SPEEDS[speed].label}</Text>
                                        <Text className="text-gray-400 text-xs mt-1">{PHASE_SPEEDS[speed].durationLabel}</Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </View>
                    </ScrollView>

                    <View className="flex-row gap-2.5 w-full">
                        <TouchableOpacity
                            className="flex-1 py-3 rounded-xl items-center bg-zinc-800"
                            onPress={handleClose}
                        >
                            <Text className="text-white font-bold">Annuler</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            className="flex-1 py-3 rounded-xl items-center bg-primary-start"
                            onPress={handleConfirm}
                        >
                            <Text className="text-white font-bold">
                                {mode === "create" ? "Créer" : "Sauvegarder"}
                            </Text>
                        </TouchableOpacity>
                    </View>
                </Pressable>
            </Pressable>
        </Modal>
    )
}