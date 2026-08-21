// app/screens/game.screen.tsx
import React from 'react'
import { View, Text, Image, KeyboardAvoidingView, Platform, useWindowDimensions } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { useGameStore } from '../stores/game.store'
import { useAuthStore } from '../stores/auth.store'
import { leaveGame, submitAnswer } from '../modules/game/game.service'
import { leaveLobby } from '../modules/lobby/lobby.service'

import { ScreenLayout } from '../components/ScreenLayout'
import { SectionTitle } from '../components/SectionTitle'
import { LoadingSpinner } from '../components/LoadingSpinner'
import { CornerShape } from '../components/CornerShape'
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
        totalRounds,
        catalog,
        mySelection,
        hasAnswered,
        toggleSelection,
    } = useGameStore()

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
    const blurredCoverSize = Math.round(Math.max(90, Math.min(140, windowHeight * 0.17)))

    if (phase === 'finished') {
        return (
            <ScreenLayout shapes={GAME_SHAPES}>
                <FinalResults
                    leaderboard={finalLeaderboard}
                    totalRounds={totalRounds}
                    onStayInLobby={handleStayInLobby}
                    onBackToHome={handleBackToHome}
                    lastPreviewUrl={round?.track.previewUrl}
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
            <KeyboardAvoidingView
                style={{ flex: 1 }}
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            >
                <ScreenLayout noPadding shapes={!isSearchMode ? GAME_SHAPES : undefined}>
                    {!isSearchMode ? (
                        <View className="flex-1 px-8 pb-10" style={{ paddingTop: insets.top + 24 }}>
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
                                <AudioPlayer previewUrl={round.track.previewUrl} />
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
                        // en mode blindtest, la pochette floutée et le titre restent en
                        // haut, tandis que le décompte et la recherche restent groupés en
                        // bas de l'écran : quand le clavier s'ouvre, KeyboardAvoidingView
                        // réduit l'espace disponible et ce bloc du bas remonte au-dessus
                        <View
                            className="flex-1 px-8 pb-4 justify-between"
                            style={{ paddingTop: insets.top + 24 }}
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

                                <View className="items-center mt-4 mb-3">
                                    <BlurredCover imageUri={round.track.image} size={blurredCoverSize} />
                                </View>

                                <View className="mb-4">
                                    <AudioPlayer previewUrl={round.track.previewUrl} compact />
                                </View>

                                <Text className="text-black text-lg font-bold text-center">
                                    Quelle est cette musique ?
                                </Text>
                            </View>

                            <SearchTrackQuestion
                                catalog={catalog}
                                hasAnswered={hasAnswered}
                                selectedId={mySelection[0] ?? null}
                                startedAt={round.startedAt}
                                duration={round.duration}
                                onAnswer={(id) => {
                                    toggleSelection(id, false)
                                    submitAnswer([id])
                                }}
                            />
                        </View>
                    )}
                </ScreenLayout>
            </KeyboardAvoidingView>
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
