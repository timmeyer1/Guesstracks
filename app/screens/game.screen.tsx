// app/screens/game.screen.tsx
import React from 'react'
import { View, Text, Image } from 'react-native'
import { useNavigation } from '@react-navigation/native'

import { useGameStore } from '../stores/game.store'
import { useAuthStore } from '../stores/auth.store'
import { leaveGame, submitAnswer } from '../modules/game/game.service'
import { leaveLobby } from '../modules/lobby/lobby.service'
import { isWhoLikedOption, isGuessTrackOption } from '../core/types'

import { ScreenLayout } from '../components/ScreenLayout'
import { SectionTitle } from '../components/SectionTitle'
import { RoundHeader } from '../components/game/RoundHeader'
import { AudioPlayer } from '../components/game/AudioPlayer'
import { WhoLikedQuestion } from '../components/game/WhoLikedQuestion'
import { GuessTrackOptions } from '../components/game/GuessTrackOptions'
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
        mySelection,
        hasAnswered,
        toggleSelection,
    } = useGameStore()

    const handleBackToHome = async () => {
        await leaveLobby()
        leaveGame()
        navigation.reset({ index: 0, routes: [{ name: 'Home' }] })
    }

    if (phase === 'finished') {
        return (
            <ScreenLayout>
                <FinalResults
                    leaderboard={finalLeaderboard}
                    totalRounds={totalRounds}
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
        return (
            <ScreenLayout>
                <RoundHeader
                    roundIndex={round.roundIndex}
                    totalRounds={round.totalRounds}
                    startedAt={round.startedAt}
                    duration={round.duration}
                    gameMode={gameMode}
                />

                {round.track.name && (
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
                )}

                <View className="mb-6">
                    <AudioPlayer previewUrl={round.track.previewUrl} />
                </View>

                {round.questionType === 'who_liked' ? (
                    <WhoLikedQuestion
                        options={round.options.filter(isWhoLikedOption)}
                        selected={mySelection}
                        hasAnswered={hasAnswered}
                        onToggle={(id) => toggleSelection(id, true)}
                        onSubmit={() => submitAnswer(mySelection)}
                    />
                ) : (
                    <GuessTrackOptions
                        options={round.options.filter(isGuessTrackOption)}
                        selected={mySelection}
                        hasAnswered={hasAnswered}
                        onAnswer={(id) => {
                            toggleSelection(id, false)
                            submitAnswer([id])
                        }}
                    />
                )}
            </ScreenLayout>
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
