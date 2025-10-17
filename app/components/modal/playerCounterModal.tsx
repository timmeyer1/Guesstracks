import React, { useState } from 'react';
import {
    Modal,
    View,
    Text,
    TouchableOpacity,
    Pressable,
} from 'react-native';
import {PlayerCounterModalstyle} from "./style/PlayerCounterModal";

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
            <Pressable style={PlayerCounterModalstyle.overlay} onPress={onClose}>
                <Pressable style={PlayerCounterModalstyle.modal}>
                    <Text style={PlayerCounterModalstyle.title}>Nombre de joueurs</Text>
                    <Text style={PlayerCounterModalstyle.subtitle}>Choisis entre 2 et 10 joueurs</Text>

                    <View style={PlayerCounterModalstyle.counterContainer}>
                        <TouchableOpacity onPress={decrease} style={PlayerCounterModalstyle.counterButton}>
                            <Text style={PlayerCounterModalstyle.counterText}>−</Text>
                        </TouchableOpacity>

                        <Text style={PlayerCounterModalstyle.count}>{count}</Text>

                        <TouchableOpacity onPress={increase} style={PlayerCounterModalstyle.counterButton}>
                            <Text style={PlayerCounterModalstyle.counterText}>＋</Text>
                        </TouchableOpacity>
                    </View>

                    <View style={PlayerCounterModalstyle.actions}>
                        <TouchableOpacity style={[PlayerCounterModalstyle.button, PlayerCounterModalstyle.cancel]} onPress={onClose}>
                            <Text style={PlayerCounterModalstyle.buttonText}>Annuler</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[PlayerCounterModalstyle.button, PlayerCounterModalstyle.confirm]}
                            onPress={() => {
                                onConfirm(count);
                                onClose();
                            }}
                        >
                            <Text style={PlayerCounterModalstyle.buttonText}>Créer</Text>
                        </TouchableOpacity>
                    </View>
                </Pressable>
            </Pressable>
        </Modal>
    );
};

