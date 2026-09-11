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

type DeezerProfileModalProps = {
    visible: boolean;
    onClose: () => void;
    onConfirm: (profileInput: string) => void;
    error?: string;
    onInputChange?: () => void;
    isSubmitting?: boolean;
};

export const DeezerProfileModal = ({
    visible,
    onClose,
    onConfirm,
    error,
    onInputChange,
    isSubmitting = false,
}: DeezerProfileModalProps) => {
    const [input, setInput] = useState('');

    const handleChangeInput = (text: string) => {
        setInput(text);
        onInputChange?.();
    };

    const handleConfirm = () => {
        if (input.trim().length > 0 && !isSubmitting) {
            onConfirm(input.trim());
        }
    };

    const handleClose = () => {
        setInput('');
        onClose();
    };

    return (
        <Modal transparent visible={visible} animationType="fade" onRequestClose={handleClose}>
            {/* behavior="padding" sur iOS : sans ça, le clavier recouvre le champ
                de saisie sur les écrans plus petits (iPhone SE/mini...) puisque la
                modale reste centrée verticalement au lieu de remonter (même
                correctif que JoinLobbyModal.tsx/CsvProfileModal.tsx). */}
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
                            title="Connexion Deezer"
                            subtitle="Colle le lien de ton profil Deezer (ex: deezer.com/profile/1234567). Ton profil doit être public pour qu'on récupère tes titres likés."
                            align="center"
                            titleSize="md"
                            subtitleSize="sm"
                            className="mb-6"
                        />

                        <TextInput
                            className="bg-offwhite text-dark text-center text-base rounded-2xl px-6 py-4 w-full"
                            value={input}
                            onChangeText={handleChangeInput}
                            placeholder="Lien ou ID de profil Deezer"
                            placeholderTextColor={COLORS.darkgray}
                            autoCapitalize="none"
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
                                    name={isSubmitting ? "Connexion..." : "Se connecter"}
                                    onPress={handleConfirm}
                                    variant="deezer"
                                    available={input.trim().length > 0 && !isSubmitting}
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
