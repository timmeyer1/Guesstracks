import React from 'react';
import { Modal, View, Text, Pressable, ScrollView, Linking } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS } from '../../core/constants/colors.constants';
import { getDeviceKind, type DeviceKind } from '../../core/device';
import { SectionTitle } from '../SectionTitle';
import { CustomButton } from '../Button';

const TUNEMYMUSIC_URL = 'https://www.tunemymusic.com/fr/transfer';
const SOUNDIIZ_URL = 'https://soundiiz.com/fr/transfer';

type CsvImportInstructionsModalProps = {
    visible: boolean;
    onClose: () => void;
    // ouvre le sélecteur de fichier une fois le CSV exporté
    onImport: () => void;
    isImporting?: boolean;
};

// que l'étape 3 change vraiment entre iOS (feuille de partage) et Android/PC
// (direct dans Téléchargements). Le reste marche pareil pour TuneMyMusic et Soundiiz.
const STEPS_BY_DEVICE: Record<DeviceKind, string[]> = {
    ios: [
        "Connecte-toi à ton service préféré.",
        "Sélectionne tes titres likés / playlists.",
        "Sélectionne \"Exporter vers le dossier\" puis choisis \"CSV\".",
        "Appuie sur \"Partager\" puis \"Enregistrer dans Fichiers\".",
        "Reviens ici et téléverse le fichier CSV.",
    ],
    android: [
        "Connecte-toi à ton service préféré comme source et sélectionne tes playlists.",
        "Sélectionne \"Exporter vers le dossier\" puis choisis \"CSV\".",
        "Le fichier CSV se télécharge automatiquement dans ton dossier Téléchargements.",
        "Reviens ici et téléverse le fichier CSV.",
    ],
    desktop: [
        "Connecte-toi à ton service préféré comme source et sélectionne tes playlists.",
        "Sélectionne \"Exporter vers le dossier\" puis choisis \"CSV\".",
        "Le fichier CSV se télécharge automatiquement dans ton dossier Téléchargements.",
        "Reviens ici et téléverse le fichier CSV.",
    ],
};

// avant on redirigeait direct vers TuneMyMusic sans expliquer quoi faire.
// dcp maintenant y'a une marche à suivre, les deux services en option (au cas
// où un des deux marche pas avec ta source), et un bouton pour revenir importer.
export const CsvImportInstructionsModal = ({
    visible,
    onClose,
    onImport,
    isImporting = false,
}: CsvImportInstructionsModalProps) => {
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
                        subtitle="Exporte ta bibliothèque en CSV avec l'un de ces services, puis reviens l'importer ici."
                        align="center"
                        titleSize="md"
                        subtitleSize="sm"
                        className="mb-6"
                    />

                    <ScrollView style={{ maxHeight: 280 }} showsVerticalScrollIndicator={false}>
                        <View className="gap-4">
                            {steps.map((step, index) => (
                                <View key={index} className="flex-row gap-3 items-center">
                                    {/* mêmes couleurs que les modes de jeu, juste pour être cohérent visuellement */}
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

                    <View className="flex-row gap-2.5 w-full mt-6">
                        <View className="flex-1">
                            <CustomButton
                                name="TuneMyMusic"
                                onPress={() => Linking.openURL(TUNEMYMUSIC_URL)}
                                variant="white"
                            />
                        </View>
                        <View className="flex-1">
                            <CustomButton
                                name="Soundiiz"
                                onPress={() => Linking.openURL(SOUNDIIZ_URL)}
                                variant="white"
                            />
                        </View>
                    </View>

                    <View className="w-full mt-2.5">
                        <CustomButton
                            name={isImporting ? "Import..." : "J'ai mon fichier, l'importer"}
                            icon="FileUp"
                            onPress={onImport}
                            variant="dark"
                            loading={isImporting}
                        />
                    </View>
                </Pressable>
            </Pressable>
        </Modal>
    );
};
