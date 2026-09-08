import React, { useEffect, useMemo, useRef, useState } from 'react'
import { View, Text, ScrollView, Animated, Pressable } from 'react-native'
import Reanimated, { LinearTransition } from 'react-native-reanimated'
import { Image } from 'expo-image'
import { Flag, CircleCheck } from 'lucide-react-native'
import { COLORS } from '../../core/constants/colors.constants'
import { SectionTitle } from '../SectionTitle'
import { StatusPill } from '../StatusPill'
import { CustomButton } from '../Button'
import { AudioPlayerButton } from './AudioPlayer'
import { useGameStore } from '../../stores/game.store'
import { useLobbyStore } from '../../stores/lobby.store'
import { useAuthStore } from '../../stores/auth.store'
import { advanceRound, reportWrongPreview } from '../../modules/game/game.service'
import type { GameRoundEnd, GameRoundPlayerResult, QuestionType, CatalogEntry } from '../../core/types'

const SCORE_COUNT_UP_MS = 900
// durée du glissement d'une ligne du classement vers son nouveau rang quand
// un joueur en dépasse un autre. Utilise react-native-reanimated (pas l'API
// LayoutAnimation de React Native) : cette dernière est un no-op silencieux
// sur la New Architecture (Fabric, activée sur ce projet, cf. app.json), donc
// n'animait jamais rien alors qu'aucune erreur ne le signalait.
const REORDER_DURATION_MS = 800
const reorderTransition = LinearTransition.duration(REORDER_DURATION_MS)
// délai avant de basculer vers l'ordre final du classement. RoundResult est
// démonté et remonté à chaque manche (game.screen.tsx bascule entièrement
// vers l'écran de question entre deux résultats), donc le prop layout de
// Reanimated ci-dessus n'a rien à animer au tout premier rendu : on monte
// d'abord sur l'ordre D'AVANT cette manche (cf. previousOrder plus bas), puis
// on rebascule sur l'ordre final après ce court délai — c'est CE second rendu,
// dans le même montage, que Reanimated anime.
const REORDER_DELAY_MS = 200
// n'affiche "série de N" qu'à partir de 2 manches parfaites d'affilée — à 1,
// ce n'est pas encore une "série", et streakBonus vaut d'ailleurs 0 ce tour-là
const MIN_STREAK_TO_DISPLAY = 2

// anime le total d'un joueur de son ancien score vers son nouveau score
// (from -> to, cf. usage plus bas) plutôt que de l'afficher déjà à jour :
// rend visible en direct le gain de la manche qu'on vient de voir détaillé
// juste au-dessus, au lieu d'un chiffre qui saute instantanément
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
    // pour savoir si result.roundIndex est la dernière manche (cf.
    // manualAdvance plus bas : le bouton doit alors annoncer "Résultat final"
    // plutôt que "Manche suivante")
    totalRounds: number
    // absent du payload "round:end" du serveur (cf. game.service.js) pour ne
    // pas influencer la manche pendant qu'elle est encore en cours ; on le
    // récupère à la place depuis le round qui vient de se terminer côté
    // client (cf. game.screen.tsx) pour prolonger l'extrait pendant l'écran
    // de résultat plutôt que de le couper net
    previewUrl?: string | null
    // état/contrôle du lecteur partagé avec l'écran de question (cf.
    // useSyncedAudioPlayer dans game.screen.tsx) : ce composant n'a plus sa
    // propre instance audio, pour que l'extrait continue sans coupure/rechute
    // au changement d'écran plutôt que d'être rechargé
    audioPlaying: boolean
    onToggleAudio: () => void
    // catalogue de recherche du mode blindtest (cf. game.store.ts) : nécessaire
    // pour retrouver le nom du titre cherché par chaque joueur à partir de son
    // selectedIds, absent du payload "round:end" comme previewUrl ci-dessus
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

    // en mode "avancer manuellement" (cf. LobbyType.manualAdvance), le
    // serveur n'enchaîne plus tout seul sur la manche suivante : seul l'hôte
    // (même convention que lobby.screen.tsx : premier joueur du lobby) peut
    // la déclencher, les autres joueurs voient juste qu'ils attendent
    const manualAdvance = useGameStore((s) => s.manualAdvance)
    const lobbyUsers = useLobbyStore((s) => s.users)
    const authUser = useAuthStore((s) => s.user)
    const isHost = lobbyUsers[0]?.id === authUser?.id
    const isLastRound = result.roundIndex === totalRounds - 1
    const [isAdvancing, setIsAdvancing] = useState(false)
    // pas de reset explicite au changement de manche : RoundResult est
    // démonté et remonté à chaque manche (cf. le commentaire sur
    // REORDER_DELAY_MS plus haut), ce qui réinitialise déjà cet état
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

    // reconstitue ce que chaque joueur a répondu à partir de son
    // selectedIds : liste de noms de joueurs en mode who_liked (Who Liked It), titre
    // cherché (via le catalogue) en mode blindtest
    const answerLabel = (r: GameRoundPlayerResult) => {
        if (!r.answered || r.selectedIds.length === 0) return 'Pas de réponse'
        if (questionType === 'who_liked') {
            return r.selectedIds.map(nameOf).join(', ')
        }
        const track = catalogById.get(r.selectedIds[0])
        return track ? `${track.name} — ${track.artist}` : 'Titre inconnu'
    }

    // ordre affiché du classement : démarre sur le classement D'AVANT cette
    // manche (en retirant les points gagnés ce tour-ci de chaque total), puis
    // bascule sur l'ordre final après REORDER_DELAY_MS — cf. le commentaire
    // sur REORDER_DELAY_MS plus haut pour pourquoi ce détour est nécessaire
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
                {/* le titre reste centré exactement comme avant (mêmes props
                    SectionTitle) ; le bouton play/pause est juste superposé à
                    côté en position absolue, sans influencer sa mise en page */}
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
                {/* seulement si un extrait a vraiment été joué (previewUrl) :
                    signaler l'absence de son se ferait de toute façon voir
                    tout seul, inutile d'ajouter un bouton pour ça */}
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
                            className="flex-row items-center justify-between bg-white rounded-2xl p-3 mb-2 shadow-card"
                        >
                            <View className="flex-row items-center gap-3 flex-1 mr-2">
                                <Text className="text-darkgray font-bold w-5">{index + 1}</Text>
                                <Image
                                    source={{ uri: entry.img || 'https://i.pravatar.cc/100' }}
                                    style={{ width: 32, height: 32, borderRadius: 16 }}
                                    cachePolicy="memory-disk"
                                    transition={100}
                                />
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
