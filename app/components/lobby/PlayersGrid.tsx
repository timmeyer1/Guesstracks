import React from 'react'
import { View, Text, TouchableOpacity } from 'react-native'
import { Plus } from 'lucide-react-native'
import { COLORS } from '../../core/constants/colors.constants'
import { PlayerAvatar, AVATAR_SIZES } from './PlayerAvatar'

interface User {
    id: string
    name: string
    img?: string
}

type AvatarSize = keyof typeof AVATAR_SIZES

interface PlayersGridProps {
    users: User[]
    maxPlayers: number
    onInvite: () => void
    size?: AvatarSize
    // hôte uniquement : appui sur un autre joueur pour le gérer (mettre hôte, expulser)
    currentUserId?: string
    onSelectPlayer?: (user: User) => void
}

export const PlayersGrid: React.FC<PlayersGridProps> = ({
    users,
    maxPlayers,
    onInvite,
    size = 'md',
    currentUserId,
    onSelectPlayer,
}) => {
    const px = AVATAR_SIZES[size]

    const items = [...users]
    if (users.length < maxPlayers) {
        items.push({ id: 'add-button', isAddButton: true } as any)
    }

    const rows: any[][] = []
    for (let i = 0; i < items.length; i += 3) {
        rows.push(items.slice(i, i + 3))
    }

    return (
        <View className="items-center">
            {rows.map((row, rowIndex) => (
                <View
                    key={`row-${rowIndex}`}
                    className="flex-row mb-4"
                    style={{ gap: 16, width: (px + 16) * 3 - 16 }}
                >
                    {row.map((item, index) => {
                        if (item.isAddButton) {
                            return (
                                <TouchableOpacity
                                    key="add-button"
                                    onPress={onInvite}
                                    className="items-center"
                                    style={{ width: px, paddingTop: px * 0.2 }}
                                >
                                    <View style={{ width: px, height: px, borderRadius: px / 2 }}
                                        className="bg-offwhite justify-center items-center">
                                        <Plus size={px * 0.4} color={COLORS.dark} />
                                    </View>
                                    <Text className="text-dark text-sm font-semibold mt-1">
                                        Inviter
                                    </Text>
                                </TouchableOpacity>
                            )
                        }

                        const actualIndex = rowIndex * 3 + index
                        const avatar = (
                            <PlayerAvatar
                                size={size}
                                name={item.name}
                                img={item.img}
                                isHost={actualIndex === 0}
                            />
                        )

                        const canManage = !!onSelectPlayer && item.id !== currentUserId
                        if (!canManage) {
                            return <View key={item.id}>{avatar}</View>
                        }

                        return (
                            <TouchableOpacity key={item.id} onPress={() => onSelectPlayer(item)}>
                                {avatar}
                            </TouchableOpacity>
                        )
                    })}
                </View>
            ))}
        </View>
    )
}