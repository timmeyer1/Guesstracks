// app/screens/game.screen.tsx
import React from 'react'
import { View, Text, Image, KeyboardAvoidingView, Platform } from 'react-native'
import { useNavigation } from '@react-navigation/native'

import { useGameStore } from '../stores/game.store'
import { useAuthStore } from '../stores/auth.store'
import { leaveGame, submitAnswer } from '../modules/game/game.service'
import { leaveLobby } from '../modules/lobby/lobby.service'

import { ScreenLayout } from '../components/ScreenLayout'
import { SectionTitle } from '../components/SectionTitle'
import { RoundHeader } from '../components/game/RoundHeader'
import { AudioPlayer } from '../components/game/AudioPlayer'
import { WhoLikedQuestion } from '../components/game/WhoLikedQuestion'
import { SearchTrackQuestion } from '../components/game/SearchTrackQuestion'
import { BlurredCover } from '../components/game/BlurredCover'
import { RoundResult } from '../components/game/RoundResult'
import { FinalResults } from '../components/game/FinalResults'

const GameScreen = () => {
    const navigation = useNavigation()
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
    // pendant toute la partie : revenir dessus suffit, l'hôte peut relancer
    const handleStayInLobby = () => {
        useGameStore.getState().reset()
        navigation.goBack()
    }

    if (phase === 'finished') {
        return (
            <ScreenLayout>
                <FinalResults
                    leaderboard={finalLeaderboard}
                    totalRounds={totalRounds}
                    onStayInLobby={handleStayInLobby}
                    onBackToHome={handleBackToHome}
                />
            </ScreenLayout>
        )
    }

    if (phase === 'round_result' && lastRoundEnd && round && user) {
        return (
            <ScreenLayout>
                <RoundResult result={lastRoundEnd} questionType={round.questionType} myPlayerId={user.id} />
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
                <ScreenLayout noPadding>
                    {/* padding vertical réduit par rapport au reste de l'app : en mode
                    blindtest, chaque pixel compte pour garder la recherche visible
                    au-dessus du clavier */}
                    <View className={`flex-1 px-8 ${isSearchMode ? 'pt-6 pb-4' : 'py-10'}`}>
                        <RoundHeader
                            roundIndex={round.roundIndex}
                            totalRounds={round.totalRounds}
                            startedAt={round.startedAt}
                            duration={round.duration}
                            gameMode={gameMode}
                        />

                        {!isSearchMode ? (
                            <>
                                <View className="items-center mb-4">
                                    {round.track.image && (
                                        <Image
                                            source={{ uri: round.track.image }}
                                            style={{ width: 80, height: 80, borderRadius: 16 }}
                                            className="mb-2"
                                        />
                                    )}
                                    <Text className="text-black text-lg font-bold text-center">{round.track.name}</Text>
                                    <Text className="text-darkgray text-sm text-center">{round.track.artist}</Text>
                                </View>

                                <View className="mb-6">
                                    <AudioPlayer previewUrl={round.track.previewUrl} />
                                </View>

                                <WhoLikedQuestion
                                    options={round.options}
                                    selected={mySelection}
                                    hasAnswered={hasAnswered}
                                    onToggle={(id) => toggleSelection(id, true)}
                                    onSubmit={() => submitAnswer(mySelection)}
                                />
                            </>
                        ) : (
                            <>
                                <View className="flex-row items-center gap-3 mb-3">
                                    <BlurredCover imageUri={round.track.image} size={72} />
                                    <View className="flex-1">
                                        <AudioPlayer previewUrl={round.track.previewUrl} compact />
                                    </View>
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
                            </>
                        )}
                    </View>
                </ScreenLayout>
            </KeyboardAvoidingView>
        )
    }

    return (
        <ScreenLayout centered>
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
