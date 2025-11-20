import React, { useState } from 'react';
import {
    Modal,
    View,
    Text,
    TouchableOpacity,
    Pressable,
    ScrollView,
} from 'react-native';
import Slider from '@react-native-community/slider';

type CreateLobbyModalProps = {
    visible: boolean;
    onClose: () => void;
    onConfirm: (settings: LobbySettings) => void;
};

export type LobbySettings = {
    rounds: number;
    phaseSpeed: 'lente' | 'normale' | 'rapide';
};

export const CreateLobbyModal = ({ visible, onClose, onConfirm }: CreateLobbyModalProps) => {
    const [rounds, setRounds] = useState(10);
    const [phaseSpeed, setPhaseSpeed] = useState<'lente' | 'normale' | 'rapide'>('normale');

    const handleConfirm = () => {
        onConfirm({ rounds, phaseSpeed });
        onClose();
    };

    const handleClose = () => {
        setRounds(10);
        setPhaseSpeed('normale');
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
                        Créer une partie
                    </Text>

                    <Text className="text-gray-400 text-sm mb-6 text-center">
                        Configure ta partie !
                    </Text>

                    <ScrollView className="mb-6">
                        {/* Nombre de manches avec slider */}
                        <View className="mb-6">
                            <Text className="text-white font-semibold mb-3 text-center">
                                Nombre de manches : {rounds}
                            </Text>
                            <View className="bg-zinc-800 rounded-full p-1">
                                <Slider
                                    style={{ width: '100%', height: 40 }}
                                    minimumValue={5}
                                    maximumValue={20}
                                    step={1}
                                    value={rounds}
                                    onValueChange={(value) => setRounds(value)}
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
                                {(['lente', 'normale', 'rapide'] as const).map((speed) => (
                                    <TouchableOpacity
                                        key={speed}
                                        className={`flex-1 py-3 rounded-xl items-center ${phaseSpeed === speed ? 'bg-primary-start' : 'bg-zinc-800'
                                            }`}
                                        onPress={() => setPhaseSpeed(speed)}
                                    >
                                        <Text className="text-white font-bold capitalize">
                                            {speed}
                                        </Text>
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
                            <Text className="text-white font-bold">Créer</Text>
                        </TouchableOpacity>
                    </View>
                </Pressable>
            </Pressable>
        </Modal>
    );
};