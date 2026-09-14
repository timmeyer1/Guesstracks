// app/screens/game.screen.tsx
import React, { useCallback, useEffect, useRef } from 'react'
import { View, Text, KeyboardAvoidingView, Platform, useWindowDimensions } from 'react-native'
import { Image } from 'expo-image'
import { useNavigation } from '@react-navigation/native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useShallow } from 'zustand/react/shallow'
import { useWebSafeAreaInsets } from '../core/hooks/useWebSafeAreaInsets'

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

// pendant ce délai après un redémarrage de l'extrait, on ignore tout
// nouveau redémarrage
const RESTART_GUARD_MS = 800

const WHO_LIKED_TITLE_MAX_LENGTH = 40
// en mode who_liked le titre est affiché en entier (c'est pas ça qu'on
// devine), dcp s'il est trop long ça peut décaler toute la mise en page
const truncateTitle = (name?: string) =>
    name && name.length > WHO_LIKED_TITLE_MAX_LENGTH
        ? `${name.slice(0, WHO_LIKED_TITLE_MAX_LENGTH).trimEnd()}...`
        : name

// en % de la hauteur d'écran plutôt qu'en pixels fixes, dcp ça s'adapte à
// tous les téléphones : ajuste ces deux valeurs si besoin
const ROUND_TOP_EXTRA_SPACING_PERCENT = 0 // espace en plus sous le notch/la caméra
const BLURRED_COVER_SIZE_PERCENT = 0.17 // taille de la pochette floutée en blindtest

// mêmes formes sur les 3 écrans de la partie, pour garder le même look
// du début à la fin
const GAME_SHAPES = (
    <>
        <CornerShape size="50%" rotate={-90} top="-20%" left="-17%" />
        <CornerShape size="50%" rotate={-20} top="42%" right="-47%" />
        <CornerShape size="50%" rotate={110} bottom="-21%" left="35%" />
    </>
)

const GameScreen = () => {
    const navigation = useNavigation()
    // sur web en mode standalone iOS, react-native-safe-area-context reste
    // bloqué à 0, dcp on mesure la vraie valeur nous-mêmes avec
    // useWebSafeAreaInsets. Le natif n'a jamais ce problème
    const nativeInsets = useSafeAreaInsets()
    const webInsets = useWebSafeAreaInsets()
    const insets = Platform.OS === 'web' ? webInsets : nativeInsets
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
    // référence stable côté Zustand, pas besoin d'être dans le sélecteur au-dessus
    const toggleSelection = useGameStore((s) => s.toggleSelection)
    // référence stable passée à WhoLikedQuestion, dont les options sont
    // mémoïsées — une closure recréée à chaque render leur ferait perdre
    // ce bénéfice
    const handleToggleWhoLiked = useCallback((id: string) => toggleSelection(id, true), [toggleSelection])

    // retient si l'extrait a fini de jouer depuis le dernier redémarrage,
    // pour savoir si l'écran de résultat doit le relancer ou le laisser
    // tourner. Une ref plutôt qu'un state, ça doit jamais provoquer de
    // re-render
    const audioFinishedRef = useRef(false)
    useEffect(() => {
        audioFinishedRef.current = false
    }, [round?.roundIndex])

    // un seul lecteur audio pour toute la manche (question + résultat), monté
    // ici et jamais démonté entre les deux écrans, dcp l'extrait ne recharge
    // jamais (pas de saut audible). Seul le bouton play/pause change de
    // place selon la phase
    const roundAudio = useSyncedAudioPlayer({
        previewUrl: round?.track.previewUrl,
        startedAt: round?.startedAt,
    })

    // juste pour vérifier à l'oeil que l'extrait reçu correspond au titre
    // affiché. En blindtest, name/artist sont undefined pendant la question
    // (normal, le serveur cache l'identité)
    useEffect(() => {
        if (!round) return
        console.log(
            `🎵 manche ${round.roundIndex} : "${round.track.name ?? '(caché, blindtest)'}" — ${round.track.artist ?? '(caché, blindtest)'} -> ${round.track.previewUrl ?? 'AUCUN EXTRAIT'}`
        )
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [round?.roundIndex, round?.track.previewUrl])

    // pendant RESTART_GUARD_MS après un redémarrage, on bloque tout nouveau
    // redémarrage. Sans ça, deux redémarrages presque simultanés pouvaient
    // se marcher dessus — vu sur Android avec le bouton play/pause qui
    // clignote juste après
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

    // dès qu'on arrive sur un écran de résultat, si l'extrait avait déjà fini
    // avant, on le relance depuis le début plutôt que de le laisser
    // silencieux. Synchronisé comme au lancement d'une manche, mais sans
    // recréer le lecteur. S'il tournait encore, on touche à rien
    useEffect(() => {
        if (!audioFinishedRef.current) return
        const syncAt =
            phase === 'round_result' && lastRoundEnd
                ? lastRoundEnd.audioStartedAt
                : phase === 'finished' && finalAudioStartedAt !== null
                  ? finalAudioStartedAt
                  : null
        if (syncAt === null) return

        // on le repasse à false tout de suite, l'autre effet le remettra
        // à true si besoin
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

    // pareil que l'effet au-dessus, mais pour le cas où l'extrait finit tout
    // seul PENDANT que le résultat est déjà affiché (manche et extrait qui
    // durent pareil, par exemple). Sinon l'extrait reste silencieux tout le
    // reste de l'écran
    useEffect(() => {
        if (!roundAudio.status.didJustFinish) return
        if (phase !== 'round_result' && phase !== 'finished') {
            audioFinishedRef.current = true
            return
        }
        restartPreview()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [roundAudio.status.didJustFinish])

    // même principe que dans lobby.screen.tsx : navigation direct sans
    // attendre le serveur
    const handleBackToHome = () => {
        leaveLobby()
        leaveGame()
        navigation.reset({ index: 0, routes: [{ name: 'Home' }] })
    }

    // le lobby reste actif en arrière-plan pendant toute la partie, dcp y
    // revenir suffit pour rejouer. On utilise resetForRematch (pas reset) :
    // on reste dans ce lobby, les infos de retour des joueurs doivent survivre
    const handleStayInLobby = () => {
        useGameStore.getState().resetForRematch()
        navigation.goBack()
    }

    // en blindtest le clavier s'ouvre direct, dcp peu de place sur les petits
    // écrans (iPhone SE...). La pochette floutée s'adapte à la hauteur
    // d'écran plutôt qu'une taille fixe, pour que la recherche reste
    // toujours visible
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
            // KeyboardAvoidingView doit envelopper seulement la recherche
            // blindtest, pas tout l'écran. avant, en l'englobant autour de
            // ScreenLayout, les formes décoratives bougeaient aussi dès que
            // le clavier s'ouvrait, alors qu'elles doivent rester fixes
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
                            {/* le titre reste centré comme avant, le bouton play/pause
                                est juste posé par-dessus en absolu, sans changer la
                                mise en page */}
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
                    // en blindtest, le décompte/la pochette/le titre restent en haut,
                    // et la recherche suit juste en dessous du titre (pas plaquée
                    // en bas de l'écran : sur un écran haut ou avec peu de contenu
                    // au-dessus, elle se retrouvait trop loin en bas pour qu'on la
                    // remarque). quand le clavier s'ouvre, KeyboardAvoidingView
                    // réduit la place disponible (natif) ; sur web, c'est la hauteur
                    // de <html> elle-même qui rétrécit avec le clavier (cf.
                    // public/index.html). Limité à ce contenu pour ne pas toucher
                    // aux formes décoratives (voir plus haut)
                    <KeyboardAvoidingView
                        style={{ flex: 1 }}
                        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                    >
                        <View
                            className="flex-1 px-8 pb-4"
                            style={{ paddingTop: insets.top + topExtraSpacing }}
                        >
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

                            <Text className="text-black text-lg font-bold text-center mb-4">
                                Quelle est cette musique ?
                            </Text>

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
