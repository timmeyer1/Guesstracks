import React from "react"
import { Modal, View, Pressable } from "react-native"
import { SectionTitle } from "../SectionTitle"
import { CustomButton } from "../Button"
import type { LobbyUserType } from "../../core/types"

type PlayerActionsModalProps = {
    player: LobbyUserType | null
    onClose: () => void
    onTransferHost: () => void
    onKick: () => void
}

// popup ouverte par l'hôte en appuyant sur un autre joueur du lobby
export const PlayerActionsModal = ({ player, onClose, onTransferHost, onKick }: PlayerActionsModalProps) => {
    return (
        <Modal transparent visible={!!player} animationType="fade" onRequestClose={onClose}>
            <Pressable className="flex-1 bg-black/60 justify-center items-center px-8" onPress={onClose}>
                <Pressable className="bg-white w-full rounded-3xl p-6">
                    <SectionTitle
                        title={player?.name}
                        subtitle="Que veux-tu faire ?"
                        align="center"
                        titleSize="md"
                        subtitleSize="sm"
                        className="mb-6"
                    />

                    <View className="gap-2.5 w-full">
                        <CustomButton name="Mettre hôte" onPress={onTransferHost} icon="Crown" variant="dark" />
                        <CustomButton
                            name="Expulser"
                            onPress={onKick}
                            icon="UserX"
                            variant="white"
                            className="border-2 border-disconnect"
                        />
                        <CustomButton name="Annuler" onPress={onClose} variant="white" />
                    </View>
                </Pressable>
            </Pressable>
        </Modal>
    )
}
