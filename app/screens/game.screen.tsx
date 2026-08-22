// app/screens/game.screen.tsx
import React from 'react'
import { View, Text, Image, KeyboardAvoidingView, Platform, useWindowDimensions } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useShallow } from 'zustand/react/shallow'

import { useGameStore } from '../stores/game.store'
import { useAuthStore } from '../stores/auth.store'
import { leaveGame, submitAnswer } from '../modules/game/game.service'
import { leaveLobby } from '../modules/lobby/lobby.service'
import { useCountdown } from '../core/hooks/useCountdown'

import { ScreenLayout } from '../components/ScreenLayout'
import { SectionTitle } from '../components/SectionTitle'
import { LoadingSpinner } from '../components/LoadingSpinner'
import { CornerShape } from '../components/CornerShape'
import { StatusPill } from '../components/StatusPill'
import { COLORS } from '../core/constants/colors.constants'
import { RoundHeader } from '../components/game/RoundHeader'
import { AudioPlayer } from '../components/game/AudioPlayer'
import { WhoLikedQuestion } from '../components/game/WhoLikedQuestion'
import { SearchTrackQuestion } from '../components/game/SearchTrackQuestion'
import { BlurredCover } from '../components/game/BlurredCover'
import { RoundResult } from '../components/game/RoundResult'
import { FinalResults } from '../components/game/FinalResults'

const GUESSTRACKS_TITLE_MAX_LENGTH = 40
// en mode guesstracks le titre est toujours affiché en entier pendant la
// manche (ce n'est pas ce qu'on devine, cf. core/types.ts) : un titre trop
// long peut prendre plusieurs lignes et pousser le reste de la mise en page
const truncateTitle = (name?: string) =>
    name && name.length > GUESSTRACKS_TITLE_MAX_LENGTH
        ? `${name.slice(0, GUESSTRACKS_TITLE_MAX_LENGTH).trimEnd()}...`
        : name

// Tailles exprimées en % de la hauteur d'écran (plutôt qu'en pixels fixes)
// pour s'adapter à tous les téléphones : ajuste ces deux valeurs si besoin.
const ROUND_TOP_EXTRA_SPACING_PERCENT = 0 // espace sous la zone de sécurité (notch / caméra), en plus de l'inset
const BLURRED_COVER_SIZE_PERCENT = 0.17 // taille de la pochette floutée en mode blindtest

// mêmes formes sur les 3 écrans de la partie (question, résultat de manche, résultats finaux)
// pour garder une identité visuelle cohérente du début à la fin du jeu
const GAME_SHAPES = (
    <>
        <CornerShape size="50%" rotate={-90} top="-20%" left="-17%" />
        <CornerShape size="50%" rotate={-20} top="42%" right="-47%" />
        <CornerShape size="50%" rotate={110} bottom="-21%" left="35%" />
    </>
)

const GameScreen = () => {
    const navigation = useNavigation()
    const insets = useSafeAreaInsets()
    const { height: windowHeight } = useWindowDimensions()
    const user = useAuthStore((s) => s.user)
    const {
        phase,
        gameMode,
        round,
        lastRoundEnd,
        finalLeaderboard,
        finalAudioStartedAt,
        totalRounds,
        catalog,
        mySelection,
        hasAnswered,
    } = useGameStore(
        useShallow((s) => ({
            phase: s.phase,
            gameMode: s.gameMode,
            round: s.round,
            lastRoundEnd: s.lastRoundEnd,
            finalLeaderboard: s.finalLeaderboard,
            finalAudioStartedAt: s.finalAudioStartedAt,
            totalRounds: s.totalRounds,
            catalog: s.catalog,
            mySelection: s.mySelection,
            hasAnswered: s.hasAnswered,
        }))
    )
    // action stable (référence figée par Zustand) : pas besoin d'être dans le sélecteur ci-dessus
    const toggleSelection = useGameStore((s) => s.toggleSelection)

    // affiché au-dessus de la pochette floutée en mode blindtest (cf. plus
    // bas) : appelé sans condition (règle des hooks), round peut être vide
    // hors phase "in_round"
    const { remaining } = useCountdown(round?.startedAt ?? 0, round?.duration ?? 0)

    const handleBackToHome = async () => {
        await leaveLobby()
        leaveGame()
        navigation.reset({ index: 0, routes: [{ name: 'Home' }] })
    }

    // le lobby (et l'abonnement socket de partie) reste actif en arrière-plan
    // pendant toute la partie : revenir dessus suffit, l'hôte peut relancer.
    // resetForRematch (pas reset) : on reste dans CE lobby, donc
    // submittedPlayerIds/pendingReturnPlayerIds doivent survivre le temps que
    // le serveur confirme le retour de chacun (cf. game.store.ts)
    const handleStayInLobby = () => {
        useGameStore.getState().resetForRematch()
        navigation.goBack()
    }

    // en mode blindtest, le clavier s'ouvre dès le début de la manche (cf.
    // SearchTrackQuestion), ce qui laisse peu de place verticale au-dessus de
    // la barre de recherche sur les écrans plus petits (iPhone SE/mini...) :
    // la pochette floutée est mise à l'échelle de la hauteur d'écran
    // disponible plutôt qu'à une taille fixe, pour que la recherche reste
    // toujours accessible sans rien masquer.
    const topExtraSpacing = windowHeight * ROUND_TOP_EXTRA_SPACING_PERCENT
    const blurredCoverSize = Math.round(windowHeight * BLURRED_COVER_SIZE_PERCENT)

    if (phase === 'finished') {
        return (
            <ScreenLayout shapes={GAME_SHAPES}>
                <FinalResults
                    leaderboard={finalLeaderboard}
                    totalRounds={totalRounds}
                    onStayInLobby={handleStayInLobby}
                    onBackToHome={handleBackToHome}
                    lastPreviewUrl={round?.track.previewUrl}
                    audioStartedAt={finalAudioStartedAt}
                />
            </ScreenLayout>
        )
    }

    if (phase === 'round_result' && lastRoundEnd && round && user) {
        return (
            <ScreenLayout shapes={GAME_SHAPES}>
                <RoundResult
                    result={lastRoundEnd}
                    questionType={round.questionType}
                    myPlayerId={user.id}
                    previewUrl={round.track.previewUrl}
                />
            </ScreenLayout>
        )
    }

    if (phase === 'in_round' && round) {
        const isSearchMode = round.questionType === 'guess_track'

        return (
            // KeyboardAvoidingView ne doit envelopper QUE le contenu qui a
            // besoin de laisser de la place au clavier (la recherche
            // blindtest, cf. ci-dessous) : l'englober autour de ScreenLayout
            // (comme avant) faisait aussi rétrécir/repositionner les formes
            // décoratives (CornerShape, positionnées en % de leur conteneur)
            // dès que le clavier s'ouvrait, alors qu'elles doivent rester
            // fixes par rapport à l'écran entier.
            <ScreenLayout noPadding shapes={GAME_SHAPES}>
                {!isSearchMode ? (
                    <View className="flex-1 px-8 pb-10" style={{ paddingTop: insets.top + topExtraSpacing }}>
                        <RoundHeader
                            roundIndex={round.roundIndex}
                            totalRounds={round.totalRounds}
                            startedAt={round.startedAt}
                            duration={round.duration}
                            gameMode={gameMode}
                            compact
                        />

                        <View className="items-center mb-4">
                            {round.track.image && (
                                <Image
                                    source={{ uri: round.track.image }}
                                    style={{ width: 80, height: 80, borderRadius: 16 }}
                                    className="mb-2"
                                />
                            )}
                            <Text className="text-black text-lg font-bold text-center">
                                {truncateTitle(round.track.name)}
                            </Text>
                            <Text className="text-darkgray text-sm text-center">{round.track.artist}</Text>
                        </View>

                        <View className="mb-6">
                            <AudioPlayer previewUrl={round.track.previewUrl} startedAt={round.startedAt} />
                        </View>

                        <WhoLikedQuestion
                            options={round.options}
                            selected={mySelection}
                            hasAnswered={hasAnswered}
                            startedAt={round.startedAt}
                            duration={round.duration}
                            onToggle={(id) => toggleSelection(id, true)}
                            onSubmit={() => submitAnswer(mySelection)}
                        />
                    </View>
                ) : (
                    // en mode blindtest, le décompte, la pochette floutée et le titre
                    // restent en haut, tandis que la recherche reste seule en bas de
                    // l'écran : quand le clavier s'ouvre, KeyboardAvoidingView réduit
                    // l'espace disponible et ce bloc du bas remonte au-dessus. Limité à
                    // ce seul contenu (cf. commentaire plus haut) pour ne pas affecter
                    // les formes décoratives de ScreenLayout.
                    <KeyboardAvoidingView
                        style={{ flex: 1 }}
                        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                    >
                        <View
                            className="flex-1 px-8 pb-4 justify-between"
                            style={{ paddingTop: insets.top + topExtraSpacing }}
                        >
                            <View>
                                <RoundHeader
                                    roundIndex={round.roundIndex}
                                    totalRounds={round.totalRounds}
                                    startedAt={round.startedAt}
                                    duration={round.duration}
                                    gameMode={gameMode}
                                    compact
                                />

                                <View className="flex-row items-center justify-center gap-3 mt-4 mb-3">
                                    <AudioPlayer previewUrl={round.track.previewUrl} startedAt={round.startedAt} compact />
                                    <StatusPill text={`Temps restant : ${remaining}s`} />
                                </View>

                                <View className="items-center mb-3">
                                    <BlurredCover imageUri={round.track.image} size={blurredCoverSize} />
                                </View>

                                <Text className="text-black text-lg font-bold text-center">
                                    Quelle est cette musique ?
                                </Text>
                            </View>

                            <SearchTrackQuestion
                                catalog={catalog}
                                hasAnswered={hasAnswered}
                                selectedId={mySelection[0] ?? null}
                                onAnswer={(id) => {
                                    toggleSelection(id, false)
                                    submitAnswer([id])
                                }}
                            />
                        </View>
                    </KeyboardAvoidingView>
                )}
            </ScreenLayout>
        )
    }

    return (
        <ScreenLayout centered>
            <View className="mb-4">
                <LoadingSpinner size={32} color={COLORS.primary} />
            </View>
            <SectionTitle
                title="Préparation de la partie..."
                subtitle="On rassemble les musiques likées de tout le monde !"
                align="center"
                size="md"
            />
        </ScreenLayout>
    )
}

export default GameScreen
