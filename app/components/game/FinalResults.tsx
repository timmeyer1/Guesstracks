import React from 'react'
import { View, Text, ScrollView } from 'react-native'
import { Trophy } from 'lucide-react-native'
import { COLORS } from '../../core/constants/colors.constants'
import { SectionTitle } from '../SectionTitle'
import { CustomButton } from '../Button'
import { AudioPlayerButton } from './AudioPlayer'
import { Avatar } from '../Avatar'
import type { FinalLeaderboardEntry } from '../../core/types'

type FinalResultsProps = {
    leaderboard: FinalLeaderboardEntry[]
    totalRounds: number
    onStayInLobby: () => void
    onBackToHome: () => void
    // extrait de la dernière manche, pour que la musique continue au lieu de
    // s'arrêter net à l'écran final
    lastPreviewUrl?: string | null
    // le lecteur audio est partagé avec les écrans précédents, dcp ce
    // composant n'a pas son propre lecteur — ça évite que l'extrait
    // recommence ou coupe en changeant d'écran
    audioPlaying: boolean
    onToggleAudio: () => void
}

// ordre d'affichage du podium : 2e, 1er, 3e (au centre, en hauteur)
const PODIUM_ORDER = [1, 0, 2]
const PODIUM_HEIGHTS = [96, 128, 72]

export const FinalResults: React.FC<FinalResultsProps> = ({
    leaderboard,
    totalRounds,
    onStayInLobby,
    onBackToHome,
    lastPreviewUrl,
    audioPlaying,
    onToggleAudio,
}) => {
    const podium = leaderboard.slice(0, 3)
    const rest = leaderboard.slice(3)

    return (
        <View className="flex-1">
            <SectionTitle
                title="Résultats"
                subtitle={`${totalRounds} manches jouées`}
                align="center"
                titleSize="lg"
                className="mb-6"
            />

            <View className="flex-row items-end justify-center gap-3 mb-6">
                {PODIUM_ORDER.map((rank, i) => {
                    const entry = podium[rank]
                    if (!entry) return <View key={`empty-${i}`} style={{ width: 90 }} />

                    const isWinner = rank === 0
                    return (
                        <View key={entry.playerId} className="items-center" style={{ width: 90 }}>
                            <Avatar uri={entry.img} size={56} className="mb-2" />
                            <Text className="text-black font-bold text-sm mb-1" numberOfLines={1}>
                                {entry.name}
                            </Text>
                            <View
                                className="w-full rounded-t-2xl items-center justify-start pt-2"
                                style={{ height: PODIUM_HEIGHTS[i], backgroundColor: isWinner ? COLORS.primary : COLORS.offwhite }}
                            >
                                {isWinner && <Trophy size={20} color={COLORS.white} />}
                                <Text
                                    className="font-bold text-xs mt-1"
                                    style={{ color: isWinner ? COLORS.white : COLORS.dark }}
                                >
                                    {entry.total} pts
                                </Text>
                                <Text
                                    className="text-[10px] mt-0.5"
                                    style={{ color: isWinner ? COLORS.white : COLORS.darkgray }}
                                >
                                    {entry.accuracy}% • 🔥{entry.bestStreak}
                                </Text>
                            </View>
                        </View>
                    )
                })}
            </View>

            {lastPreviewUrl && (
                <View className="mb-4">
                    <AudioPlayerButton previewUrl={lastPreviewUrl} playing={audioPlaying} onToggle={onToggleAudio} compact />
                </View>
            )}

            <ScrollView className="flex-1 mb-4" showsVerticalScrollIndicator={false}>
                {rest.map((entry, index) => (
                    <View
                        key={entry.playerId}
                        className="flex-row items-start justify-between bg-offwhite rounded-2xl p-3 mb-2"
                    >
                        <View className="flex-row items-center gap-3">
                            <Text className="text-darkgray font-bold w-5">{index + 4}</Text>
                            <Avatar uri={entry.img} size={32} />
                            <View>
                                <Text className="text-black font-semibold">{entry.name}</Text>
                                <Text className="text-darkgray text-xs">
                                    {entry.accuracy}% de réussite • série max {entry.bestStreak}
                                </Text>
                            </View>
                        </View>
                        <Text className="text-black font-bold">{entry.total} pts</Text>
                    </View>
                ))}
            </ScrollView>

            <View className="gap-2.5">
                <CustomButton name="Rester dans le lobby" onPress={onStayInLobby} variant="white" icon="Users" />
                <CustomButton name="Quitter" onPress={onBackToHome} variant="dark" icon="LogOut" />
            </View>
        </View>
    )
}
