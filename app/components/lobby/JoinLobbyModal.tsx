import React, { useState } from 'react';
import {
    Modal,
    View,
    Text,
    TextInput,
    TouchableOpacity,
    Pressable,
} from 'react-native';

type JoinLobbyModalProps = {
    visible: boolean;
    onClose: () => void;
    onConfirm: (code: string) => void;
};

export const JoinLobbyModal = ({ visible, onClose, onConfirm }: JoinLobbyModalProps) => {
    const [code, setCode] = useState('');

    const handleConfirm = () => {
        if (code.length === 4) {
            onConfirm(code);
            setCode(''); // Reset après confirmation
            onClose();
        }
    };

    const handleClose = () => {
        setCode(''); // Reset à la fermeture
        onClose();
    };

    return (
        <Modal transparent visible={visible} animationType="fade" onRequestClose={handleClose}>
            <Pressable 
                className="flex-1 bg-black/60 justify-center items-center"
                onPress={handleClose}
            >
                <Pressable className="bg-[#1a1a1a] w-4/5 rounded-3xl p-6 items-center">
                    <Text className="text-white text-2xl font-bold mb-2">
                        Rejoindre une partie
                    </Text>
                    
                    <Text className="text-gray-400 text-sm mb-6">
                        Entrez le code secret !
                    </Text>

                    <TextInput
                        className="bg-zinc-800 text-white text-center text-3xl font-bold tracking-[8px] rounded-xl px-6 py-4 mb-6 w-full"
                        value={code}
                        onChangeText={(text) => setCode(text.toUpperCase().slice(0, 4))}
                        placeholder="_ _ _ _"
                        placeholderTextColor="#4a4a4a"
                        maxLength={4}
                        autoCapitalize="characters"
                        autoCorrect={false}
                        keyboardType="default"
                    />

                    <View className="flex-row gap-2.5 w-full">
                        <TouchableOpacity 
                            className="flex-1 py-3 rounded-xl items-center bg-zinc-800"
                            onPress={handleClose}
                        >
                            <Text className="text-white font-bold">Annuler</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            className={`flex-1 py-3 rounded-xl items-center ${
                                code.length === 4 ? 'bg-spotify-primary' : 'bg-zinc-700'
                            }`}
                            onPress={handleConfirm}
                            disabled={code.length !== 4}
                        >
                            <Text className={`font-bold ${
                                code.length === 4 ? 'text-white' : 'text-gray-500'
                            }`}>
                                Rejoindre
                            </Text>
                        </TouchableOpacity>
                    </View>
                </Pressable>
            </Pressable>
        </Modal>
    );
};