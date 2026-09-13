import React, { useState } from 'react';
import {
    Modal,
    View,
    Text,
    TextInput,
    Pressable,
    KeyboardAvoidingView,
    Platform,
} from 'react-native';
import { COLORS } from '../../core/constants/colors.constants';
import { SectionTitle } from '../SectionTitle';
import { CustomButton } from '../Button';

type JoinLobbyModalProps = {
    visible: boolean;
    onClose: () => void;
    onConfirm: (code: string) => void;
    error?: string;
    onCodeChange?: () => void;
    isSubmitting?: boolean;
};

const CODE_LENGTH = 4;

export const JoinLobbyModal = ({
    visible,
    onClose,
    onConfirm,
    error,
    onCodeChange,
    isSubmitting = false,
}: JoinLobbyModalProps) => {
    const [code, setCode] = useState('');

    const handleChangeCode = (text: string) => {
        setCode(text.toUpperCase().slice(0, CODE_LENGTH));
        onCodeChange?.();
    };

    const handleConfirm = () => {
        if (code.length === CODE_LENGTH) {
            onConfirm(code);
        }
    };

    const handleClose = () => {
        setCode('');
        onClose();
    };

    return (
        <Modal transparent visible={visible} animationType="fade" onRequestClose={handleClose}>
            {/* padding sur iOS sinon le clavier recouvre le champ sur les petits écrans */}
            <KeyboardAvoidingView
                style={{ flex: 1 }}
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            >
                <Pressable
                    className="flex-1 bg-black/60 justify-center items-center px-8"
                    onPress={handleClose}
                >
                    <Pressable className="bg-white w-full rounded-3xl p-6 items-center">
                        <SectionTitle
                            title="Rejoindre une partie"
                            subtitle="Entre le code secret !"
                            align="center"
                            titleSize="md"
                            subtitleSize="sm"
                            className="mb-6"
                        />

                        <TextInput
                            className="bg-offwhite text-dark text-center text-3xl font-bold tracking-[8px] rounded-2xl px-6 py-4 w-full"
                            value={code}
                            onChangeText={handleChangeCode}
                            placeholder="____"
                            placeholderTextColor={COLORS.darkgray}
                            maxLength={CODE_LENGTH}
                            autoCapitalize="characters"
                            autoCorrect={false}
                            keyboardType="default"
                        />

                        {error && (
                            <Text
                                className="text-sm font-semibold text-center mt-3"
                                style={{ color: COLORS.disconnect }}
                            >
                                {error}
                            </Text>
                        )}

                        <View className="flex-row gap-2.5 w-full mt-6">
                            <View className="flex-1">
                                <CustomButton
                                    name="Annuler"
                                    onPress={handleClose}
                                    variant="dark"
                                />
                            </View>

                            <View className="flex-1">
                                <CustomButton
                                    name={isSubmitting ? "Connexion..." : "Rejoindre"}
                                    onPress={handleConfirm}
                                    variant="white"
                                    available={code.length === CODE_LENGTH && !isSubmitting}
                                    loading={isSubmitting}
                                />
                            </View>
                        </View>
                    </Pressable>
                </Pressable>
            </KeyboardAvoidingView>
        </Modal>
    );
};
