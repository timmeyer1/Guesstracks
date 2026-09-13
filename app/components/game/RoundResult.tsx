import React, { useEffect, useMemo, useRef, useState } from 'react'
import { View, Text, ScrollView, Animated, Pressable } from 'react-native'
import Reanimated, { LinearTransition } from 'react-native-reanimated'
import { Image } from 'expo-image'
import { Flag, CircleCheck } from 'lucide-react-native'
import { COLORS } from '../../core/constants/colors.constants'
import { SectionTitle } from '../SectionTitle'
import { StatusPill } from '../StatusPill'
import { CustomButton } from '../Button'
import { Avatar } from '../Avatar'
import { AudioPlayerButton } from './AudioPlayer'
import { useGameStore } from '../../stores/game.store'
import { useLobbyStore } from '../../stores/lobby.store'
import { useAuthStore } from '../../stores/auth.store'
import { advanceRound, reportWrongPreview } from '../../modules/game/game.service'
import type { GameRoundEnd, GameRoundPlayerResult, QuestionType, CatalogEntry } from '../../core/types'

const SCORE_COUNT_UP_MS = 900
// durée de l'animation quand un joueur change de place dans le classement.
// On utilise reanimated et pas LayoutAnimation de RN, en gros ce dernier
// marche pas du tout sur la New Architecture qu'utilise l'app
const REORDER_DURATION_MS = 800
const reorderTransition = LinearTransition.duration(REORDER_DURATION_MS)
// petit délai avant de passer à l'ordre final du classement, pour que
// l'animation de réordonnancement ait vraiment quelque chose à animer au
// montage du composant (sinon rien ne bouge visuellement)
const REORDER_DELAY_MS = 200
// on affiche "série de N" qu'à partir de 2 manches parfaites d'affilée
const MIN_STREAK_TO_DISPLAY = 2

// anime le score d'un joueur de son ancien total vers le nouveau, plutôt que
// de sauter direct au chiffre final — ça rend le gain de points plus visible
type AnimatedScoreProps = { from: number; to: number; style?: object }

const AnimatedScore: React.FC<AnimatedScoreProps> = ({ from, to, style }) => {
    const [display, setDisplay] = useState(from)
    const animatedValue = useRef(new Animated.Value(from)).current

    useEffect(() => {
        const listenerId = animatedValue.addListener(({ value }) => setDisplay(Math.round(value)))
        Animated.timing(animatedValue, {
            toValue: to,
            duration: SCORE_COUNT_UP_MS,
            useNativeDriver: false,
        }).start()
        return () => animatedValue.removeListener(listenerId)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [to])

    return <Text style={style}>{display} pts</Text>
}

type RoundResultProps = {
    result: GameRoundEnd
    questionType: QuestionType
    myPlayerId: string
    // pour savoir si c'est la dernière manche (change le texte du bouton)
    totalRounds: number
    // le serveur l'envoie pas dans le résultat, dcp on le récupère côté
    // client pour continuer l'extrait plutôt que de le couper net
    previewUrl?: string | null
    // le lecteur audio est partagé avec l'écran de question, ce composant a
    // pas son propre lecteur — ça évite les coupures en changeant d'écran
    audioPlaying: boolean
    onToggleAudio: () => void
    // catalogue du blindtest, pour retrouver le nom du titre que chaque
    // joueur a cherché à partir de son id
    catalog?: CatalogEntry[]
}

export const RoundResult: React.FC<RoundResultProps> = ({
    result,
    questionType,
    myPlayerId,
    totalRounds,
    previewUrl,
    audioPlaying,
    onToggleAudio,
    catalog = [],
}) => {
    const nameOf = (id: string) => result.leaderboard.find((entry) => entry.playerId === id)?.name ?? '???'
    const catalogById = useMemo(() => new Map(catalog.map((t) => [t.id, t])), [catalog])
    const resultsById = useMemo(() => new Map(result.results.map((r) => [r.playerId, r])), [result.results])
    const leaderboardById = useMemo(
        () => new Map(result.leaderboard.map((entry) => [entry.playerId, entry])),
        [result.leaderboard]
    )
    const myResult = resultsById.get(myPlayerId)

    // en mode "avancer manuellement", seul l'hôte peut passer à la manche
    // suivante, les autres attendent juste
    const manualAdvance = useGameStore((s) => s.manualAdvance)
    const lobbyUsers = useLobbyStore((s) => s.users)
    const authUser = useAuthStore((s) => s.user)
    const isHost = lobbyUsers[0]?.id === authUser?.id
    const isLastRound = result.roundIndex === totalRounds - 1
    const [isAdvancing, setIsAdvancing] = useState(false)
    // pas besoin de reset manuel, le composant est remonté à chaque manche
    const [wrongPreviewReported, setWrongPreviewReported] = useState(false)

    const handleNextRound = () => {
        if (isAdvancing) return
        setIsAdvancing(true)
        advanceRound()
    }

    const handleReportWrongPreview = () => {
        if (wrongPreviewReported) return
        setWrongPreviewReported(true)
        reportWrongPreview(result.roundIndex)
    }

    // retrouve ce qu'un joueur a répondu : des noms en mode who_liked, un
    // titre de musique en mode blindtest
    const answerLabel = (r: GameRoundPlayerResult) => {
        if (!r.answered || r.selectedIds.length === 0) return 'Pas de réponse'
        if (questionType === 'who_liked') {
            return r.selectedIds.map(nameOf).join(', ')
        }
        const track = catalogById.get(r.selectedIds[0])
        return track ? `${track.name} — ${track.artist}` : 'Titre inconnu'
    }

    // on affiche d'abord le classement d'avant cette manche, puis on bascule
    // sur le nouvel ordre juste après (voir REORDER_DELAY_MS plus haut)
    const previousOrder = () =>
        [...result.leaderboard]
            .sort((a, b) => {
                const prevA = a.total - (resultsById.get(a.playerId)?.points ?? 0)
                const prevB = b.total - (resultsById.get(b.playerId)?.points ?? 0)
                return prevB - prevA
            })
            .map((entry) => entry.playerId)

    const [order, setOrder] = useState<string[]>(previousOrder)

    useEffect(() => {
        setOrder(previousOrder())
        const timer = setTimeout(() => {
            setOrder(result.leaderboard.map((entry) => entry.playerId))
        }, REORDER_DELAY_MS)
        return () => clearTimeout(timer)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [result.roundIndex])

    return (
        <View className="flex-1">
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
                {/* le titre reste centré, le bouton play/pause est juste posé par-dessus */}
                <View style={{ alignSelf: 'stretch', alignItems: 'center' }}>
                    <SectionTitle
                        title={result.track.name}
                        subtitle={result.track.artist}
                        align="center"
                        titleSize="md"
                        subtitleSize="sm"
                    />
                    {previewUrl && (
                        <View style={{ position: 'absolute', left: 0, top: 0, bottom: 0, justifyContent: 'center' }}>
                            <AudioPlayerButton previewUrl={previewUrl} playing={audioPlaying} onToggle={onToggleAudio} compact />
                        </View>
                    )}
                </View>
                {/* affiché que s'il y a un extrait, pas besoin de bouton sinon */}
                {previewUrl && (
                    <Pressable
                        onPress={handleReportWrongPreview}
                        disabled={wrongPreviewReported}
                        hitSlop={8}
                        className="flex-row items-center gap-1 mt-2"
                    >
                        {wrongPreviewReported ? (
                            <>
                                <CircleCheck size={13} color={COLORS.darkgray} />
                                <Text className="text-darkgray" style={{ fontSize: 11 }}>
                                    Signalé, merci !
                                </Text>
                            </>
                        ) : (
                            <>
                                <Flag size={13} color={COLORS.darkgray} />
                                <Text className="text-darkgray" style={{ fontSize: 11 }}>
                                    Pas le bon extrait ?
                                </Text>
                            </>
                        )}
                    </Pressable>
                )}
            </View>

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
                <View className="rounded-3xl p-4 mb-4 bg-offwhite">
                    <View className="items-center mb-1">
                        <Text className="text-2xl font-bold text-black">+{myResult.points} pts</Text>
                        {myResult.isPerfect && (
                            <Text className="text-darkgray text-sm mt-1">
                                {myResult.streak >= MIN_STREAK_TO_DISPLAY
                                    ? `Parfait ! Série de ${myResult.streak} 🔥`
                                    : 'Parfait ! 🎯'}
                            </Text>
                        )}
                        {!myResult.answered && (
                            <Text className="text-darkgray text-sm mt-1">Pas de réponse envoyée à temps</Text>
                        )}
                    </View>

                    {myResult.points > 0 && (
                        <View className="rounded-2xl px-3 py-2 mt-2" style={{ backgroundColor: COLORS.white }}>
                            <View className="flex-row items-center justify-between">
                                <Text className="text-darkgray flex-1" style={{ fontSize: 12 }} numberOfLines={1}>
                                    Précision · vitesse {Math.round(myResult.speedFactor * 100)}%
                                    {myResult.perfectBonus > 0 && ` · +${myResult.perfectBonus} parfait`}
                                    {myResult.streakBonus > 0 && ` · +${myResult.streakBonus} série`}
                                </Text>
                                <Text className="text-black font-bold" style={{ fontSize: 12 }}>
                                    {myResult.points} pts
                                </Text>
                            </View>
                        </View>
                    )}
                </View>
            )}

            <SectionTitle title="Classement" align="left" titleSize="sm" className="mb-2" />
            <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
                {order.map((playerId, index) => {
                    const entry = leaderboardById.get(playerId)
                    if (!entry) return null
                    const r = resultsById.get(playerId)
                    const roundPoints = r?.points ?? 0
                    const isCorrect = roundPoints > 0
                    const answerColor = isCorrect ? COLORS.success : COLORS.error
                    return (
                        <Reanimated.View
                            key={playerId}
                            layout={reorderTransition}
                            // en style inline et pas en className : sur un Reanimated.View,
                            // NativeWind (le className) marche pas correctement
                            style={{
                                flexDirection: 'row',
                                alignItems: 'flex-start',
                                justifyContent: 'space-between',
                                backgroundColor: COLORS.offwhite,
                                borderRadius: 16,
                                padding: 12,
                                marginBottom: 8,
                            }}
                        >
                            <View className="flex-row items-center gap-3 flex-1 mr-2">
                                <Text className="text-darkgray font-bold w-5">{index + 1}</Text>
                                <Avatar uri={entry.img} size={32} />
                                <View className="flex-1">
                                    <Text className="text-black font-semibold" numberOfLines={1}>
                                        {entry.name}
                                    </Text>
                                    {r && (
                                        <Text style={{ color: answerColor, fontSize: 11 }} numberOfLines={1}>
                                            {answerLabel(r)}
                                        </Text>
                                    )}
                                </View>
                            </View>
                            <View className="items-end">
                                <AnimatedScore
                                    from={entry.total - roundPoints}
                                    to={entry.total}
                                    style={{ color: COLORS.dark, fontWeight: 'bold' as const }}
                                />
                                {roundPoints > 0 && (
                                    <Text className="text-xs font-semibold" style={{ color: COLORS.success }}>
                                        +{roundPoints}
                                    </Text>
                                )}
                            </View>
                        </Reanimated.View>
                    )
                })}
            </ScrollView>

            {manualAdvance && (
                <View className="mt-4">
                    {isHost ? (
                        <CustomButton
                            name={
                                isAdvancing
                                    ? isLastRound
                                        ? 'Résultat final...'
                                        : 'Manche suivante...'
                                    : isLastRound
                                      ? 'Résultat final'
                                      : 'Manche suivante'
                            }
                            onPress={handleNextRound}
                            icon={isLastRound ? 'Trophy' : 'ArrowRight'}
                            variant="dark"
                            available={!isAdvancing}
                            loading={isAdvancing}
                        />
                    ) : (
                        <StatusPill
                            text={
                                isLastRound
                                    ? "En attente de l'hôte pour les résultats finaux"
                                    : "En attente de l'hôte pour la manche suivante"
                            }
                        />
                    )}
                </View>
            )}
        </View>
    )
}
