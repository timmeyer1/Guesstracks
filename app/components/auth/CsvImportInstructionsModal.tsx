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
    // déclenche le sélecteur de fichier natif (cf. login.screen.tsx,
    // handleUploadCsv) une fois le CSV exporté depuis TuneMyMusic/Soundiiz
    onImport: () => void;
    isImporting?: boolean;
};

// étape 3 seulement : sur iOS, le téléchargement passe par la feuille de
// partage du navigateur ; sur Android/PC, le fichier va directement dans le
// dossier Téléchargements, sans étape "Partager" équivalente. Générique aux
// deux services proposés plus bas (TuneMyMusic/Soundiiz) : leurs parcours
// d'export se ressemblent assez pour ne pas dupliquer ces étapes par service.
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

// remplace l'ancienne redirection directe vers TuneMyMusic (Linking.openURL
// au clic du bouton "CSV via TuneMyMusic") : sans marche à suivre,
// l'utilisateur arrivait sur le site sans savoir quoi y faire. Propose
// maintenant TuneMyMusic ET Soundiiz (deux services équivalents, au cas où
// l'un des deux ne supporterait pas le service source du joueur), plus un
// bouton pour revenir importer le fichier obtenu sans quitter cet écran.
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
