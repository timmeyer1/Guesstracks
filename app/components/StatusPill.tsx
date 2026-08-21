// app/components/StatusPill.tsx
import React from 'react'
import { View, Text, StyleProp, ViewStyle } from 'react-native'
import { COLORS } from '../core/constants/colors.constants'
import { LoadingSpinner } from './LoadingSpinner'

type StatusPillProps = {
    text: string
    className?: string
    style?: StyleProp<ViewStyle>
}

/**
 * Petite pastille "en attente de ..." avec icône animée, comme sur la maquette
 * ("En attente de l'hôte", "En attente de joueurs", "Temps restant : 12s").
 */
export const StatusPill: React.FC<StatusPillProps> = ({ text, className = '', style }) => (
    <View
        className={`flex-row items-center self-center gap-2 bg-offwhite rounded-full px-5 py-3 ${className}`}
        style={style}
    >
        <LoadingSpinner size={18} color={COLORS.darkgray} />
        <Text className="text-black font-semibold text-sm">{text}</Text>
    </View>
)
