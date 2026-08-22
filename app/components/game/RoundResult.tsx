import React from 'react'
import { View, Text, ScrollView } from 'react-native'
import { Image } from 'expo-image'
import { COLORS } from '../../core/constants/colors.constants'
import { SectionTitle } from '../SectionTitle'
import { AudioPlayer } from './AudioPlayer'
import type { GameRoundEnd, QuestionType } from '../../core/types'

type RoundResultProps = {
    result: GameRoundEnd
    questionType: QuestionType
    myPlayerId: string
    // absent du payload "round:end" du serveur (cf. game.service.js) pour ne
    // pas influencer la manche pendant qu'elle est encore en cours ; on le
    // récupère à la place depuis le round qui vient de se terminer côté
    // client (cf. game.screen.tsx) pour prolonger l'extrait pendant l'écran
    // de résultat plutôt que de le couper net
    previewUrl?: string | null
}

export const RoundResult: React.FC<RoundResultProps> = ({ result, questionType, myPlayerId, previewUrl }) => {
    const nameOf = (id: string) => result.leaderboard.find((entry) => entry.playerId === id)?.name ?? '???'
    const myResult = result.results.find((r) => r.playerId === myPlayerId)

    return (
        <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
            <View className="items-center mb-4">
                {result.track.image && (
                    <Image
                        source={{ uri: result.track.image }}
                        style={{ width: 96, height: 96, borderRadius: 16 }}
                        className="mb-3"
                        cachePolicy="memory-disk"
                        transition={100}
                    />
                )}
                <SectionTitle
                    title={result.track.name}
                    subtitle={result.track.artist}
                    align="center"
                    titleSize="md"
                    subtitleSize="sm"
                />
            </View>

            {previewUrl && (
                <View className="mb-4">
                    <AudioPlayer previewUrl={previewUrl} compact />
                </View>
            )}

            <View className="bg-offwhite rounded-3xl p-4 mb-4 items-center">
                <Text className="text-darkgray text-sm mb-1">
                    {questionType === 'who_liked' ? 'Ont liké cette musique :' : 'La bonne réponse'}
                </Text>
                <Text className="text-black font-bold text-base text-center">
                    {questionType === 'who_liked'
                        ? result.correctAnswerIds.map(nameOf).join(', ') || 'Personne dans le lobby'
                        : `${result.track.name} — ${result.track.artist}`}
                </Text>
            </View>

            {myResult && (
                <View
                    className="rounded-3xl p-4 mb-4"
                    style={{ backgroundColor: myResult.points > 0 ? COLORS.success + '20' : COLORS.error + '20' }}
                >
                    <View className="items-center mb-1">
                        <Text
                            className="text-2xl font-bold"
                            style={{ color: myResult.points > 0 ? COLORS.success : COLORS.error }}
                        >
                            +{myResult.points} pts
                        </Text>
                        {myResult.isPerfect && (
                            <Text className="text-darkgray text-sm mt-1">Parfait ! Série de {myResult.streak} 🔥</Text>
                        )}
                        {!myResult.answered && (
                            <Text className="text-darkgray text-sm mt-1">Pas de réponse envoyée à temps</Text>
                        )}
                    </View>

                    {myResult.points > 0 && (
                        <View
                            className="rounded-2xl p-3 mt-2 gap-1"
                            style={{ backgroundColor: 'rgba(255, 255, 255, 0.6)' }}
                        >
                            <View className="flex-row justify-between">
                                <Text className="text-darkgray text-sm">Points normaux</Text>
                                <Text className="text-black font-semibold text-sm">{myResult.basePoints} pts</Text>
                            </View>
                            {myResult.bonusPoints > 0 && (
                                <View className="flex-row justify-between">
                                    <Text className="text-darkgray text-sm">Bonus</Text>
                                    <Text className="text-black font-semibold text-sm">
                                        +{myResult.bonusPoints} pts
                                    </Text>
                                </View>
                            )}
                            <View className="flex-row justify-between pt-1">
                                <Text className="text-black font-bold text-sm">Total de la manche</Text>
                                <Text className="text-black font-bold text-sm">{myResult.points} pts</Text>
                            </View>
                        </View>
                    )}
                </View>
            )}

            <SectionTitle title="Classement" align="left" titleSize="sm" className="mb-2" />
            {result.leaderboard.map((entry, index) => (
                <View
                    key={entry.playerId}
                    className="flex-row items-center justify-between bg-white rounded-2xl p-3 mb-2 shadow-card"
                >
                    <View className="flex-row items-center gap-3">
                        <Text className="text-darkgray font-bold w-5">{index + 1}</Text>
                        <Image
                            source={{ uri: entry.img || 'https://i.pravatar.cc/100' }}
                            style={{ width: 32, height: 32, borderRadius: 16 }}
                            cachePolicy="memory-disk"
                            transition={100}
                        />
                        <Text className="text-black font-semibold">{entry.name}</Text>
                    </View>
                    <Text className="text-black font-bold">{entry.total} pts</Text>
                </View>
            ))}
        </ScrollView>
    )
}
