import React from 'react';
import { Modal, View, Text, Pressable, ScrollView, Linking, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS } from '../../core/constants/colors.constants';
import { SectionTitle } from '../SectionTitle';
import { CustomButton } from '../Button';

const TUNEMYMUSIC_URL = 'https://www.tunemymusic.com/fr/transfer';

type TuneMyMusicInstructionsModalProps = {
    visible: boolean;
    onClose: () => void;
};

type DeviceKind = 'ios' | 'android' | 'desktop';

// Platform.OS vaut 'web' aussi bien sur iPhone/Android/PC (le site tourne
// dans un navigateur sur les trois) : seul l'user agent permet de
// distinguer, comme déjà fait dans StandaloneGate.tsx
const getDeviceKind = (): DeviceKind => {
    if (Platform.OS === 'ios') return 'ios';
    if (Platform.OS === 'android') return 'android';
    if (Platform.OS === 'web' && typeof navigator !== 'undefined') {
        if (/iPhone|iPad|iPod/i.test(navigator.userAgent)) return 'ios';
        if (/Android/i.test(navigator.userAgent)) return 'android';
    }
    return 'desktop';
};

// étape 3 seulement : sur iOS, le téléchargement passe par la feuille de
// partage du navigateur ; sur Android/PC, le fichier va directement dans le
// dossier Téléchargements, sans étape "Partager" équivalente
const STEPS_BY_DEVICE: Record<DeviceKind, string[]> = {
    ios: [
        "Connecte-toi à ton service préféré comme source et sélectionne tes playlists.",
        "Sélectionne \"Exporter vers le dossier\" puis choisis \"CSV\".",
        "Appuie sur \"Partager\" puis \"Enregistrer dans Fichiers\".",
        "Téléverse le fichier CSV dans Guesstracks.",
    ],
    android: [
        "Connecte-toi à ton service préféré comme source et sélectionne tes playlists.",
        "Sélectionne \"Exporter vers le dossier\" puis choisis \"CSV\".",
        "Le fichier CSV se télécharge automatiquement dans ton dossier Téléchargements.",
        "Téléverse le fichier CSV dans Guesstracks.",
    ],
    desktop: [
        "Connecte-toi à ton service préféré comme source et sélectionne tes playlists.",
        "Sélectionne \"Exporter vers le dossier\" puis choisis \"CSV\".",
        "Le fichier CSV se télécharge automatiquement dans ton dossier Téléchargements.",
        "Téléverse le fichier CSV dans Guesstracks.",
    ],
};

// remplace l'ancienne redirection directe vers TuneMyMusic (Linking.openURL
// au clic du bouton "CSV via TuneMyMusic") : sans marche à suivre,
// l'utilisateur arrivait sur le site sans savoir quoi y faire — le bouton du
// bas n'ouvre le site qu'une fois les étapes lues, plutôt qu'à la place
export const TuneMyMusicInstructionsModal = ({ visible, onClose }: TuneMyMusicInstructionsModalProps) => {
    const handleOpenTuneMyMusic = () => {
        Linking.openURL(TUNEMYMUSIC_URL);
    };

    const steps = STEPS_BY_DEVICE[getDeviceKind()];

    return (
        <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose}>
            <Pressable
                className="flex-1 bg-black/60 justify-center items-center px-8"
                onPress={onClose}
            >
                <Pressable className="bg-white w-full rounded-3xl p-6">
                    <SectionTitle
                        title="Comment faire ?"
                        align="center"
                        titleSize="md"
                        subtitleSize="sm"
                        className="mb-6"
                    />

                    <ScrollView style={{ maxHeight: 320 }} showsVerticalScrollIndicator={false}>
                        <View className="gap-4">
                            {steps.map((step, index) => (
                                <View key={index} className="flex-row gap-3 items-center">
                                    {/* mêmes couleurs que les modes de jeu who_liked/blindtest
                                        (cf. colors.constants.ts) : pas de sens fonctionnel ici,
                                        juste un repère visuel cohérent avec le reste de l'app */}
                                    <LinearGradient
                                        colors={[COLORS.who_liked, COLORS.blindtest]}
                                        start={{ x: 0, y: 0 }}
                                        end={{ x: 1, y: 1 }}
                                        style={{ width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' }}
                                    >
                                        <Text className="text-sm font-bold text-white">{index + 1}</Text>
                                    </LinearGradient>
                                    <Text className="flex-1 text-sm text-darkgray">{step}</Text>
                                </View>
                            ))}
                        </View>
                    </ScrollView>
                    <View className="w-full mt-6">
                        <CustomButton name="TuneMyMusic" onPress={handleOpenTuneMyMusic} variant="white" />
                    </View>
                </Pressable>
            </Pressable>
        </Modal>
    );
};
