import React from 'react'
import { View, Text, Pressable } from 'react-native'
import { Flag, Clock, HelpCircle, Music, Trophy, Settings } from 'lucide-react-native'
import { GAME_MODES, getPhaseSpeedLabel } from '../../core/constants/lobby.constants'
import { COLORS, type GameMode } from '../../core/constants/colors.constants'
import { SectionTitle } from '../SectionTitle'

interface GameModeCardProps {
    gameMode?: GameMode
    rounds?: number
    phaseSpeed?: number
    onSettingsPress?: () => void
}

// icônes des modes de jeu, partagées avec LobbySettingsModal (sélecteur de mode)
export const GAME_MODE_ICONS: Record<GameMode, React.ComponentType<any>> = {
    who_liked: Music,
    blindtest: Trophy
}

const GAME_STYLES: Record<GameMode, { borderClass: string; iconColor: string }> = {
    who_liked: { borderClass: 'border-who_liked', iconColor: COLORS.who_liked },
    blindtest: { borderClass: 'border-blindtest', iconColor: COLORS.blindtest },
}

export const GameModeCard: React.FC<GameModeCardProps> = ({
    gameMode,
    rounds,
    phaseSpeed,
    onSettingsPress
}) => {
    if (!gameMode || !rounds || !phaseSpeed) {
        return <WaitingCard />
    }

    const Icon = GAME_MODE_ICONS[gameMode]
    const { borderClass, iconColor } = GAME_STYLES[gameMode]
    const modeLabel = GAME_MODES[gameMode].label
    const speedLabel = getPhaseSpeedLabel(phaseSpeed)

    return (
        <ActiveGameCard
            icon={Icon}
            color={iconColor}
            borderClass={borderClass}
            modeLabel={modeLabel}
            rounds={rounds}
            speedLabel={speedLabel}
            onSettingsPress={onSettingsPress}
        />
    )
}

const WaitingCard: React.FC = () => (
    <View className="bg-white rounded-3xl shadow-card p-6 mb-4 flex-row border-l-8 border-darkgray">
        <View className="bg-offwhite rounded-full w-16 h-16 items-center justify-center mr-4 self-center">
            <HelpCircle size={32} color={COLORS.darkgray} />
        </View>
        <View className="flex-1 justify-center">
            <Text className="text-black text-2xl font-bold">
                Mode de jeu en attente...
            </Text>
        </View>
    </View>
)

interface ActiveGameCardProps {
    icon: React.ComponentType<any>
    color: string
    borderClass: string
    modeLabel: string
    rounds: number
    speedLabel: string
    onSettingsPress?: () => void
}

const ActiveGameCard: React.FC<ActiveGameCardProps> = ({
    icon: Icon,
    color,
    borderClass,
    modeLabel,
    rounds,
    speedLabel,
    onSettingsPress
}) => {
    const backgroundColor = color + '10'

    return (
        <View className={`bg-white rounded-3xl shadow-card p-6 mb-4 flex-row border-l-8 ${borderClass}`}>
            <View
                className="rounded-full w-16 h-16 items-center justify-center mr-4 self-center"
                style={{ backgroundColor }}
            >
                <Icon size={32} color={color} />
            </View>

            <View className="flex-1">
                <SectionTitle title={modeLabel} size="md" align='left' className='mb-4' />
                <View className="flex-row items-center gap-4">
                    <InfoBadge icon={Flag} text={`${rounds} manches`} />
                    <InfoBadge icon={Clock} text={speedLabel} />
                </View>
            </View>

            {onSettingsPress && (
                <Pressable
                    onPress={onSettingsPress}
                    className="absolute top-3 right-3 bg-offwhite rounded-full p-2"
                    hitSlop={8}
                >
                    <Settings size={18} color={COLORS.darkgray} />
                </Pressable>
            )}
        </View>
    )
}

interface InfoBadgeProps {
    icon: React.ComponentType<any>
    text: string
}

const InfoBadge: React.FC<InfoBadgeProps> = ({ icon: Icon, text }) => (
    <View className="flex-row items-center bg-offwhite p-2 rounded-2xl">
        <Icon size={16} color={COLORS.darkgray} />
        <Text className="text-darkgray text-base ml-2">{text}</Text>
    </View>
)