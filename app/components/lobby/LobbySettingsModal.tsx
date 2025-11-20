import React, { useState, useEffect } from "react";
import {
    Modal,
    View,
    Text,
    TouchableOpacity,
    Pressable,
    ScrollView,
} from "react-native";
import Slider from "@react-native-community/slider";

export type LobbySettings = {
    rounds: number;
    phaseSpeed: "lent" | "normal" | "rapide";
};

type LobbySettingsModalProps = {
    visible: boolean;
    mode: "create" | "edit";
    onClose: () => void;
    onConfirm: (settings: LobbySettings) => void;
    initialSettings?: LobbySettings;
};

export const LobbySettingsModal = ({
    visible,
    mode,
    onClose,
    onConfirm,
    initialSettings,
}: LobbySettingsModalProps) => {
    const [rounds, setRounds] = useState(initialSettings?.rounds ?? 10);
    const [phaseSpeed, setPhaseSpeed] = useState<"lent" | "normal" | "rapide">(
        initialSettings?.phaseSpeed ?? "normal"
    );

    // Sync props when editing
    useEffect(() => {
        if (visible && initialSettings) {
            setRounds(initialSettings.rounds);
            setPhaseSpeed(initialSettings.phaseSpeed);
        }
    }, [visible, initialSettings]);

    const handleConfirm = () => {
        onConfirm({ rounds, phaseSpeed });
        onClose();
    };

    const handleClose = () => {
        if (initialSettings) {
            setRounds(initialSettings.rounds);
            setPhaseSpeed(initialSettings.phaseSpeed);
        } else {
            setRounds(10);
            setPhaseSpeed("normal");
        }
        onClose();
    };

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
                        {mode === "create"
                            ? "Configure ta partie !"
                            : "Modifie les règles de ta partie"}
                    </Text>

                    <ScrollView className="mb-6">
                        {/* Nombre de manches */}
                        <View className="mb-6">
                            <Text className="text-white font-semibold mb-3 text-center">
                                Nombre de manches : {rounds}
                            </Text>
                            <View className="bg-zinc-800 rounded-full p-1">
                                <Slider
                                    style={{ width: "100%", height: 40 }}
                                    minimumValue={5}
                                    maximumValue={20}
                                    step={1}
                                    value={rounds}
                                    onValueChange={setRounds}
                                    minimumTrackTintColor="#9622e0"
                                    maximumTrackTintColor="transparent"
                                    thumbTintColor="#9622e0"
                                />
                            </View>
                            <View className="flex-row justify-between mt-2">
                                <Text className="text-gray-400 text-xs">5</Text>
                                <Text className="text-gray-400 text-xs">20</Text>
                            </View>
                        </View>

                        {/* Vitesse des phases */}
                        <View className="mb-4">
                            <Text className="text-white font-semibold mb-3 text-center">
                                Vitesse des phases
                            </Text>
                            <View className="flex-row gap-2">
                                {(["lent", "normal", "rapide"] as const).map((speed) => (
                                    <TouchableOpacity
                                        key={speed}
                                        className={`flex-1 py-3 rounded-xl items-center ${phaseSpeed === speed ? "bg-primary-start" : "bg-zinc-800"
                                            }`}
                                        onPress={() => setPhaseSpeed(speed)}
                                    >
                                        <Text className="text-white font-bold capitalize">{speed}</Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </View>
                    </ScrollView>

                    {/* Buttons */}
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
    );
};
