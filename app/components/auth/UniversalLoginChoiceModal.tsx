import React from 'react';
import { Modal, View, Pressable } from 'react-native';
import { SectionTitle } from '../SectionTitle';
import { CustomButton } from '../Button';

type UniversalLoginChoiceModalProps = {
    visible: boolean;
    onClose: () => void;
    onChooseManual: () => void;
    onChooseCsvImport: () => void;
};

// première étape de la "Connexion universelle" (cf. login.screen.tsx) :
// laisse choisir entre composer sa bibliothèque à la main (recherche dans le
// catalogue Deezer, cf. ManualTrackPickerModal.tsx) ou l'importer d'un coup
// depuis un fichier CSV exporté via TuneMyMusic/Soundiiz (cf.
// CsvImportInstructionsModal.tsx) — les deux aboutissent au même profil
// pseudo + photo (cf. CsvProfileModal.tsx, réutilisée pour les deux)
export const UniversalLoginChoiceModal = ({
    visible,
    onClose,
    onChooseManual,
    onChooseCsvImport,
}: UniversalLoginChoiceModalProps) => {
    return (
        <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose}>
            <Pressable className="flex-1 bg-black/60 justify-center items-center px-8" onPress={onClose}>
                <Pressable className="bg-white w-full rounded-3xl p-6">
                    <SectionTitle
                        title="Connexion universelle"
                        align="center"
                        titleSize="md"
                        subtitleSize="sm"
                        className="mb-6"
                    />

                    <View className="gap-2.5">
                        <CustomButton
                            name="Choisir mes titres"
                            icon="Search"
                            onPress={onChooseManual}
                            variant="white"
                        />
                        <CustomButton
                            name="Importer un fichier CSV"
                            icon="FileUp"
                            onPress={onChooseCsvImport}
                            variant="white"
                        />
                    </View>
                </Pressable>
            </Pressable>
        </Modal>
    );
};
