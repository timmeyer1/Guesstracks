import React, { useState } from 'react';
import {
    Modal,
    View,
    Text,
    TextInput,
    Pressable,
} from 'react-native';
import { COLORS } from '../../core/constants/colors.constants';
import { SectionTitle } from '../SectionTitle';
import { CustomButton } from '../Button';
import { Avatar } from '../Avatar';
import { pickAndResizeProfileImage } from '../../modules/auth/profileImage';

type CsvProfileModalProps = {
    visible: boolean;
    onClose: () => void;
    onConfirm: (pseudo: string, img: string | null) => void;
    error?: string;
    onInputChange?: () => void;
};

export const CsvProfileModal = ({
    visible,
    onClose,
    onConfirm,
    error,
    onInputChange,
}: CsvProfileModalProps) => {
    const [pseudo, setPseudo] = useState('');
    const [img, setImg] = useState<string | null>(null);
    const [isPickingImage, setIsPickingImage] = useState(false);

    const handleChangePseudo = (text: string) => {
        setPseudo(text);
        onInputChange?.();
    };

    const handlePickImage = async () => {
        if (isPickingImage) return;
        setIsPickingImage(true);
        try {
            const picked = await pickAndResizeProfileImage();
            if (picked) setImg(picked);
        } catch (e) {
            console.error(e);
        } finally {
            setIsPickingImage(false);
        }
    };

    const handleConfirm = () => {
        if (pseudo.trim().length > 0) {
            onConfirm(pseudo.trim(), img);
        }
    };

    const handleClose = () => {
        setPseudo('');
        setImg(null);
        onClose();
    };

    return (
        <Modal transparent visible={visible} animationType="fade" onRequestClose={handleClose}>
            <Pressable
                className="flex-1 bg-black/60 justify-center items-center px-8"
                onPress={handleClose}
            >
                <Pressable className="bg-white w-full rounded-3xl p-6 items-center">
                    <SectionTitle
                        title="Ton profil"
                        subtitle="Choisis un pseudo et, si tu veux, une photo de profil."
                        align="center"
                        titleSize="md"
                        subtitleSize="sm"
                        className="mb-6"
                    />

                    <Pressable onPress={handlePickImage} disabled={isPickingImage} className="items-center mb-4">
                        <Avatar uri={img} size={80} />
                        <Text className="text-sm text-darkgray mt-2">
                            {isPickingImage ? 'Chargement...' : img ? 'Changer la photo' : 'Ajouter une photo'}
                        </Text>
                    </Pressable>

                    <TextInput
                        className="bg-offwhite text-dark text-center text-base rounded-2xl px-6 py-4 w-full"
                        value={pseudo}
                        onChangeText={handleChangePseudo}
                        placeholder="Ton pseudo"
                        placeholderTextColor={COLORS.darkgray}
                        autoCapitalize="words"
                        autoCorrect={false}
                        maxLength={60}
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
                                name="Go"
                                onPress={handleConfirm}
                                variant="white"
                                available={pseudo.trim().length > 0}
                            />
                        </View>
                    </View>
                </Pressable>
            </Pressable>
        </Modal>
    );
};
