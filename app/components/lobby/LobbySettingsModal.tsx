import React, { useState, useEffect, useRef } from "react"
import { Modal, View, Text, TouchableOpacity, Pressable, ScrollView, Switch } from "react-native"
import Slider from "@react-native-community/slider"
import { GAME_MODES, DEFAULT_LOBBY_SETTINGS, LOBBY_LIMITS } from "../../core/constants/lobby.constants"
import { COLORS } from "../../core/constants/colors.constants"
import { GameMode, PhaseSpeed } from "../../core/types"
import { SectionTitle } from "../SectionTitle"
import { CustomButton } from "../Button"
import { GAME_MODE_ICONS } from "./GameModeCard"

// dérive la valeur "affichée/confirmée" (multiples de 5) à partir de la
// position continue du curseur natif. `min` et `max` restent chacun un
// palier à part, tout seuls à leur extrémité respective (ex. seul 5 pile
// donne "5", seul 30 pile donne "30") ; l'espace restant de la piste est
// réparti à parts ÉGALES entre les paliers intermédiaires (10, 15, 20, 25)
// plutôt que de tout déverser sur le dernier d'entre eux (25 prenait sinon
// une place disproportionnée) — chacun occupe donc la même largeur visuelle.
// Sans prop `step` sur le <Slider> plus bas, le drag reste 100% fluide et
// natif (iOS/Android) — aucun arrondi n'intervient sur la position du
// curseur lui-même, qui reste exactement là où le doigt l'a laissé ; seul le
// nombre affiché/envoyé au serveur est calculé à partir de cette position.
const bucketToStep = (raw: number, min: number, max: number, step: number) => {
    if (raw <= min) return min
    if (raw >= max) return max
    const interiorSteps = Math.round((max - min) / step) - 1
    if (interiorSteps <= 0) return raw - min < max - raw ? min : max
    const bucketWidth = (max - min) / interiorSteps
    const index = Math.min(interiorSteps - 1, Math.floor((raw - min) / bucketWidth))
    return min + (index + 1) * step
}

export type LobbySettings = {
    gameMode: GameMode
    rounds: number
    phaseSpeed: PhaseSpeed
    manualAdvance: boolean
}

type LobbySettingsModalProps = {
    visible: boolean
    mode: "create" | "edit"
    onClose: () => void
    onConfirm: (settings: LobbySettings) => void
    initialSettings?: LobbySettings
}

export const LobbySettingsModal = ({
    visible,
    mode,
    onClose,
    onConfirm,
    initialSettings,
}: LobbySettingsModalProps) => {
    const [gameMode, setGameMode] = useState<GameMode>(
        initialSettings?.gameMode ?? DEFAULT_LOBBY_SETTINGS.gameMode
    )
    // position brute (continue) du curseur — cf. bucketToStep plus haut : ce
    // n'est pas forcément un multiple de 5, seul son "bucket" l'est
    const [roundsPosition, setRoundsPosition] = useState(
        initialSettings?.rounds ?? DEFAULT_LOBBY_SETTINGS.rounds
    )
    const [phaseSpeedPosition, setPhaseSpeedPosition] = useState<PhaseSpeed>(
        initialSettings?.phaseSpeed ?? DEFAULT_LOBBY_SETTINGS.phaseSpeed
    )
    const rounds = bucketToStep(roundsPosition, LOBBY_LIMITS.MIN_ROUNDS, LOBBY_LIMITS.MAX_ROUNDS, LOBBY_LIMITS.ROUNDS_STEP)
    const phaseSpeed = bucketToStep(
        phaseSpeedPosition,
        LOBBY_LIMITS.MIN_PHASE_SPEED,
        LOBBY_LIMITS.MAX_PHASE_SPEED,
        LOBBY_LIMITS.PHASE_SPEED_STEP
    )
    const [manualAdvance, setManualAdvance] = useState(
        initialSettings?.manualAdvance ?? DEFAULT_LOBBY_SETTINGS.manualAdvance
    )

    // couleur d'accent des réglages (curseurs, contours, switch...) : celle du
    // mode de jeu actuellement sélectionné (violet who_liked / orange
    // blindtest, cf. colors.constants.ts) plutôt qu'une couleur fixe, pour que
    // toute la modale se re-teinte instantanément quand on change de mode —
    // s'étend automatiquement à un futur mode tant qu'il a une entrée dans COLORS
    const accentColor = COLORS[gameMode]

    // synchro avec les paramètres initiaux quand la modal s'ouvre — uniquement
    // au passage fermée -> ouverte (wasVisible), pas à chaque fois que
    // `initialSettings` change de référence : ce prop vient du lobby du store
    // (cf. lobby.screen.tsx), qui est remplacé par un nouvel objet à chaque
    // mise à jour socket (ex. un joueur qui rejoint/quitte) — sans cette
    // garde, un réglage en cours (curseur en train d'être déplacé) était
    // écrasé et revenait à sa valeur serveur dès qu'un tel événement arrivait
    const wasVisible = useRef(false)
    useEffect(() => {
        if (visible && !wasVisible.current && initialSettings) {
            setGameMode(initialSettings.gameMode)
            setRoundsPosition(initialSettings.rounds)
            setPhaseSpeedPosition(initialSettings.phaseSpeed)
            setManualAdvance(initialSettings.manualAdvance)
        }
        wasVisible.current = visible
    }, [visible, initialSettings])

    const handleConfirm = () => {
        onConfirm({ gameMode, rounds, phaseSpeed, manualAdvance })
        onClose()
    }

    const handleClose = () => {
        // reset aux valeurs initiales ou par défaut
        if (initialSettings) {
            setGameMode(initialSettings.gameMode)
            setRoundsPosition(initialSettings.rounds)
            setPhaseSpeedPosition(initialSettings.phaseSpeed)
            setManualAdvance(initialSettings.manualAdvance)
        } else {
            setGameMode(DEFAULT_LOBBY_SETTINGS.gameMode)
            setRoundsPosition(DEFAULT_LOBBY_SETTINGS.rounds)
            setPhaseSpeedPosition(DEFAULT_LOBBY_SETTINGS.phaseSpeed)
            setManualAdvance(DEFAULT_LOBBY_SETTINGS.manualAdvance)
        }
        onClose()
    }

    return (
        <Modal transparent visible={visible} animationType="fade" onRequestClose={handleClose}>
            {/* backdrop en sibling absolu de la carte (pas un Pressable ancêtre qui
                l'englobe) : une Pressable ancêtre de la ScrollView capte le geste dès
                qu'on touche un espace vide de la carte, et une ScrollView ne peut
                reprendre la main que sur un DESCENDANT (bouton, slider), jamais sur un
                ancêtre — d'où un scroll qui ne fonctionnait qu'en posant le doigt sur
                un "module" et jamais sur le vide entre eux. En sibling, le tap sur le
                fond noir (hors carte) ferme la modale normalement, et la carte ne
                capte plus rien au niveau ancêtre de la ScrollView */}
            <Pressable
                className="absolute top-0 left-0 right-0 bottom-0 bg-black/60"
                onPress={handleClose}
            />
            <View
                className="flex-1 justify-center items-center px-8"
                pointerEvents="box-none"
            >
                <View className="bg-white w-full rounded-3xl p-6" style={{ maxHeight: '85%' }}>
                    <SectionTitle
                        title={mode === "create" ? "Créer une partie" : "Paramètres"}
                        subtitle={mode === "create" ? "Configure ta partie !" : "Modifie les règles"}
                        align="center"
                        titleSize="md"
                        subtitleSize="sm"
                        className="mb-6"
                    />

                    <ScrollView
                        className="mb-6"
                        showsVerticalScrollIndicator={false}
                    >
                        <View className="mb-6">
                            <SectionTitle title="Mode de jeu" align="center" titleSize="sm" className="mb-3" />
                            <View className="flex-row gap-2">
                                {(Object.keys(GAME_MODES) as GameMode[]).map((mode) => {
                                    const selected = gameMode === mode
                                    const modeColor = COLORS[mode]
                                    const Icon = GAME_MODE_ICONS[mode]
                                    return (
                                        <TouchableOpacity
                                            key={mode}
                                            className="flex-1 py-3 rounded-2xl items-center"
                                            style={{
                                                backgroundColor: selected ? modeColor + '15' : COLORS.offwhite,
                                                borderWidth: 1.5,
                                                borderColor: selected ? modeColor : 'transparent',
                                            }}
                                            onPress={() => setGameMode(mode)}
                                        >
                                            <Icon size={24} color={selected ? modeColor : COLORS.darkgray} style={{ marginBottom: 4 }} />
                                            <Text className="font-bold text-black">
                                                {GAME_MODES[mode].label}
                                            </Text>
                                        </TouchableOpacity>
                                    )
                                })}
                            </View>
                        </View>

                        <View className="mb-6">
                            <SectionTitle
                                title={`Nombre de manches : ${rounds}`}
                                align="center"
                                titleSize="sm"
                                className="mb-3"
                            />
                            <View className="bg-offwhite rounded-full p-1">
                                <Slider
                                    style={{ width: "100%", height: 40 }}
                                    minimumValue={LOBBY_LIMITS.MIN_ROUNDS}
                                    maximumValue={LOBBY_LIMITS.MAX_ROUNDS}
                                    value={roundsPosition}
                                    onValueChange={setRoundsPosition}
                                    minimumTrackTintColor={accentColor}
                                    maximumTrackTintColor="transparent"
                                    thumbTintColor={accentColor}
                                />
                            </View>
                            <View className="flex-row justify-between mt-2">
                                <Text className="text-darkgray text-xs">{LOBBY_LIMITS.MIN_ROUNDS}</Text>
                                <Text className="text-darkgray text-xs">{LOBBY_LIMITS.MAX_ROUNDS}</Text>
                            </View>
                        </View>

                        <View className="mb-4">
                            <SectionTitle
                                title={`Vitesse des phases : ${phaseSpeed}s`}
                                align="center"
                                titleSize="sm"
                                className="mb-3"
                            />
                            <View className="bg-offwhite rounded-full p-1">
                                <Slider
                                    style={{ width: "100%", height: 40 }}
                                    minimumValue={LOBBY_LIMITS.MIN_PHASE_SPEED}
                                    maximumValue={LOBBY_LIMITS.MAX_PHASE_SPEED}
                                    value={phaseSpeedPosition}
                                    onValueChange={setPhaseSpeedPosition}
                                    minimumTrackTintColor={accentColor}
                                    maximumTrackTintColor="transparent"
                                    thumbTintColor={accentColor}
                                />
                            </View>
                            <View className="flex-row justify-between mt-2">
                                <Text className="text-darkgray text-xs">{LOBBY_LIMITS.MIN_PHASE_SPEED}s</Text>
                                <Text className="text-darkgray text-xs">{LOBBY_LIMITS.MAX_PHASE_SPEED}s</Text>
                            </View>
                        </View>

                        <View className="mb-2 flex-row items-center justify-between bg-offwhite rounded-2xl px-4 py-3">
                            <View className="flex-1 mr-3">
                                <Text className="text-black font-semibold text-sm">
                                    Manche automatique
                                </Text>
                            </View>
                            <Switch
                                value={!manualAdvance}
                                onValueChange={(value) => setManualAdvance(!value)}
                                trackColor={{ true: accentColor }}
                                thumbColor={COLORS.white}
                            />
                        </View>
                    </ScrollView>

                    <View className="flex-row gap-2.5 w-full">
                        <View className="flex-1">
                            <CustomButton name="Annuler" onPress={handleClose} variant="dark" />
                        </View>

                        <View className="flex-1">
                            <CustomButton
                                name="Go"
                                onPress={handleConfirm}
                                variant="white"
                            />
                        </View>
                    </View>
                </View>
            </View>
        </Modal>
    )
}
