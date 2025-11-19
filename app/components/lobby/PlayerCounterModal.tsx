import React, { useState } from 'react';
import {
    Modal,
    View,
    Text,
    TouchableOpacity,
    Pressable,
} from 'react-native';

type PlayerCountModalProps = {
    visible: boolean;
    onClose: () => void;
    onConfirm: (count: number) => void;
};

export const PlayerCountModal = ({ visible, onClose, onConfirm }: PlayerCountModalProps) => {
    const [count, setCount] = useState(4);

    const increase = () => setCount((prev) => Math.min(prev + 1, 10));
    const decrease = () => setCount((prev) => Math.max(prev - 1, 2));

    return (
        <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose}>
            <Pressable
                className="flex-1 bg-black/60 justify-center items-center"
                onPress={onClose}
            >
                <Pressable className="bg-[#1a1a1a] w-4/5 rounded-3xl p-5 items-center">
                    <Text className="text-white text-2xl font-bold mb-1.5">
                        Nombre de joueurs
                    </Text>

                    <Text className="text-gray-400 text-sm mb-5">
                        Choisis entre 2 et 10 joueurs
                    </Text>

                    <View className="flex-row items-center mb-6">
                        <TouchableOpacity
                            onPress={decrease}
                            className="rounded-full p-3 w-15 items-center"
                        >
                            <Text className="text-white text-3xl font-bold">−</Text>
                        </TouchableOpacity>

                        <Text className="text-spotify-primary text-4xl font-bold mx-6">
                            {count}
                        </Text>

                        <TouchableOpacity
                            onPress={increase}
                            className="rounded-full p-3 w-15 items-center"
                        >
                            <Text className="text-white text-3xl font-bold">+</Text>
                        </TouchableOpacity>
                    </View>

                    <View className="flex-row gap-2.5 w-full">
                        <TouchableOpacity
                            className="flex-1 py-2.5 rounded-xl items-center bg-zinc-800"
                            onPress={onClose}
                        >
                            <Text className="text-white font-bold">Annuler</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            className="flex-1 py-2.5 rounded-xl items-center bg-spotify-primary"
                            onPress={() => {
                                onConfirm(count);
                                onClose();
                            }}
                        >
                            <Text className="text-white font-bold">Créer</Text>
                        </TouchableOpacity>
                    </View>
                </Pressable>
            </Pressable>
        </Modal>
    );
};