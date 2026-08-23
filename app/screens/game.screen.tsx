// app/screens/game.screen.tsx
import React, { useCallback, useEffect, useRef } from 'react'
import { View, Text, KeyboardAvoidingView, Platform, useWindowDimensions } from 'react-native'
import { Image } from 'expo-image'
import { useNavigation } from '@react-navigation/native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useShallow } from 'zustand/react/shallow'

import { useGameStore } from '../stores/game.store'
import { useAuthStore } from '../stores/auth.store'
import { leaveGame, submitAnswer } from '../modules/game/game.service'
import { leaveLobby } from '../modules/lobby/lobby.service'

import { ScreenLayout } from '../components/ScreenLayout'
import { SectionTitle } from '../components/SectionTitle'
import { LoadingSpinner } from '../components/LoadingSpinner'
import { CornerShape } from '../components/CornerShape'
import { StatusPill } from '../components/StatusPill'
import { COLORS } from '../core/constants/colors.constants'
import { RoundHeader } from '../components/game/RoundHeader'
import { AudioPlayerButton } from '../components/game/AudioPlayer'
import { useSyncedAudioPlayer } from '../core/hooks/useSyncedAudioPlayer'
import { WhoLikedQuestion } from '../components/game/WhoLikedQuestion'
import { SearchTrackQuestion } from '../components/game/SearchTrackQuestion'
import { BlurredCover } from '../components/game/BlurredCover'
import { RoundResult } from '../components/game/RoundResult'
import { FinalResults } from '../components/game/FinalResults'
import { CountdownLabel } from '../components/game/CountdownLabel'

// délai après un redémarrage de l'extrait pendant lequel on ignore tout
// nouveau déclenchement de redémarrage (cf. restartPreview plus bas)
const RESTART_GUARD_MS = 800

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
    // référence stable : passée à WhoLikedQuestion, dont les options sont
    // mémoïsées (cf. audit qualité, finding N4) — une closure recréée à
    // chaque render de cet écran leur ferait perdre ce bénéfice
    const handleToggleWhoLiked = useCallback((id: string) => toggleSelection(id, true), [toggleSelection])

    // mémorise si l'extrait de la manche en cours a atteint sa fin naturelle
    // depuis le dernier redémarrage (cf. les deux effets plus bas) : sert à
    // décider si un écran de résultat doit rejouer l'extrait depuis le début
    // (déjà fini) ou le laisser continuer tel quel — une ref plutôt qu'un
    // state car ça ne doit jamais provoquer de re-render
    const audioFinishedRef = useRef(false)
    useEffect(() => {
        audioFinishedRef.current = false
    }, [round?.roundIndex])

    // lecteur audio unique pour toute la durée de la manche (question ET
    // résultat, cf. useSyncedAudioPlayer) : appelé ici, à un niveau jamais
    // démonté entre ces deux écrans, plutôt que dans chacun séparément, pour
    // que l'extrait ne soit jamais rechargé (donc pas de saut audible) au
    // changement d'écran — seul le bouton <AudioPlayerButton /> qui le
    // représente est affiché à des endroits différents selon la phase.
    const roundAudio = useSyncedAudioPlayer({
        previewUrl: round?.track.previewUrl,
        startedAt: round?.startedAt,
    })

    // RESTART_GUARD_MS après un redémarrage, on ignore tout nouveau
    // déclenchement (cf. les deux effets plus bas, qui appellent tous les
    // deux restartPreview) : sans ce garde-fou, deux redémarrages quasi
    // simultanés (l'effet de transition de phase ET l'effet "fin en direct"
    // ci-dessous, ou un statut natif qui rebascule brièvement pendant le
    // seekTo) pouvaient s'enchaîner presque en même temps et se marcher
    // dessus — observé sur Android comme le bouton play/pause qui
    // s'active/se désactive très vite juste après un redémarrage.
    const restartingRef = useRef(false)
    const restartPreview = () => {
        if (restartingRef.current) return
        restartingRef.current = true
        roundAudio.player.seekTo(0).then(() => {
            roundAudio.player.play()
            setTimeout(() => {
                restartingRef.current = false
            }, RESTART_GUARD_MS)
        })
    }

    // dès qu'on bascule sur un écran de résultat (de manche OU final), si
    // l'extrait avait déjà fini de jouer AVANT cette transition, on le
    // relance depuis le début plutôt que de le laisser silencieux sur ce
    // nouvel écran — synchronisé comme au lancement de manche (audioStartedAt
    // propre à chaque transition), mais sans jamais recréer le lecteur. S'il
    // n'avait pas encore fini, on ne fait rien : il continue tel quel.
    useEffect(() => {
        if (!audioFinishedRef.current) return
        const syncAt =
            phase === 'round_result' && lastRoundEnd
                ? lastRoundEnd.audioStartedAt
                : phase === 'finished' && finalAudioStartedAt !== null
                  ? finalAudioStartedAt
                  : null
        if (syncAt === null) return

        // consommé tout de suite (cf. l'autre effet ci-dessous, qui le
        // repassera à true si l'extrait relancé finit à nouveau)
        audioFinishedRef.current = false
        const delayMs = syncAt - Date.now()
        if (delayMs <= 0) {
            restartPreview()
            return
        }
        const timeout = setTimeout(restartPreview, delayMs)
        return () => clearTimeout(timeout)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [phase])

    // symétrique de l'effet ci-dessus, pour le cas où l'extrait finit tout
    // seul PENDANT qu'un écran de résultat est déjà affiché (ex: manche de
    // 30s avec un extrait de ~30s et personne qui répond : les deux se
    // terminent quasi en même temps, souvent après la transition plutôt
    // qu'avant) — sans ça, l'effet au-dessus ne se redéclenche jamais (il ne
    // réagit qu'aux CHANGEMENTS de phase) et l'extrait reste silencieux pour
    // le reste de l'écran de résultat
    useEffect(() => {
        if (!roundAudio.status.didJustFinish) return
        if (phase !== 'round_result' && phase !== 'finished') {
            audioFinishedRef.current = true
            return
        }
        restartPreview()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [roundAudio.status.didJustFinish])

    // EXPÉRIMENTAL — navigation optimisée, même principe que
    // lobby.screen.tsx:handleLeaveLobby (cf. discussion audit perf)
    const handleBackToHome = () => {
        leaveLobby()
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
                    audioPlaying={roundAudio.status.playing}
                    onToggleAudio={roundAudio.toggle}
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
                    totalRounds={totalRounds}
                    previewUrl={round.track.previewUrl}
                    audioPlaying={roundAudio.status.playing}
                    onToggleAudio={roundAudio.toggle}
                    catalog={catalog}
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
                        <RoundHeader roundIndex={round.roundIndex} totalRounds={round.totalRounds} />

                        <View className="items-center mb-3">
                            {round.track.image && (
                                <Image
                                    source={{ uri: round.track.image }}
                                    style={{ width: 80, height: 80, borderRadius: 16 }}
                                    className="mb-2"
                                    cachePolicy="memory-disk"
                                    transition={100}
                                />
                            )}
                            {/* le titre reste centré exactement comme avant ; le
                                bouton play/pause est juste superposé à côté en
                                position absolue, sans influencer sa mise en page */}
                            <View style={{ alignSelf: 'stretch', alignItems: 'center' }}>
                                <Text className="text-black text-lg font-bold text-center">
                                    {truncateTitle(round.track.name)}
                                </Text>
                                <Text className="text-darkgray text-sm text-center">{round.track.artist}</Text>
                                <View style={{ position: 'absolute', left: 0, top: 0, bottom: 0, justifyContent: 'center' }}>
                                    <AudioPlayerButton
                                        previewUrl={round.track.previewUrl}
                                        playing={roundAudio.status.playing}
                                        onToggle={roundAudio.toggle}
                                        compact
                                    />
                                </View>
                            </View>
                        </View>

                        <View className="items-center mb-6">
                            <StatusPill text={<CountdownLabel startedAt={round.startedAt} duration={round.duration} />} />
                        </View>

                        <WhoLikedQuestion
                            options={round.options}
                            selected={mySelection}
                            hasAnswered={hasAnswered}
                            onToggle={handleToggleWhoLiked}
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
                                <RoundHeader roundIndex={round.roundIndex} totalRounds={round.totalRounds} />

                                <View className="items-center mb-3">
                                    <BlurredCover imageUri={round.track.image} size={blurredCoverSize} />
                                </View>

                                <View className="flex-row items-center justify-center gap-3 mb-3">
                                    <AudioPlayerButton
                                        previewUrl={round.track.previewUrl}
                                        playing={roundAudio.status.playing}
                                        onToggle={roundAudio.toggle}
                                        compact
                                    />
                                    <StatusPill text={<CountdownLabel startedAt={round.startedAt} duration={round.duration} />} />
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
