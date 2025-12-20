import React from 'react'
import { View, Text, TouchableOpacity } from 'react-native'
import { Plus } from 'lucide-react-native'
import { COLORS } from '../../core/constants/colors.constants'
import { PlayerAvatar } from './PlayerAvatar'

interface User {
    token: string
    name: string
    img?: string
}

interface PlayersGridProps {
    users: User[]
    maxPlayers: number
    onInvite: () => void
}

export const PlayersGrid: React.FC<PlayersGridProps> = ({
    users,
    maxPlayers,
    onInvite
}) => {
    // Créer la liste des éléments à afficher
    const items = [...users]

    // Ajouter le bouton + si pas à la limite
    if (users.length < maxPlayers) {
        items.push({ token: 'add-button', isAddButton: true } as any)
    }

    // Diviser en lignes de 3
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
                    style={{ gap: 16, width: 272 }}
                >
                    {row.map((item, index) => {
                        // Si c'est le bouton +
                        if (item.isAddButton) {
                            return (
                                <TouchableOpacity
                                    key="add-button"
                                    onPress={onInvite}
                                    className="items-center"
                                    style={{ width: 80, paddingTop: 16 }}
                                >
                                    <View className="w-20 h-20 rounded-full bg-offwhite justify-center items-center">
                                        <Plus size={32} color={COLORS.dark} />
                                    </View>
                                    <Text className="text-dark text-sm font-semibold mt-1">
                                        Inviter
                                    </Text>
                                </TouchableOpacity>
                            )
                        }

                        // Sinon c'est un joueur
                        const actualIndex = rowIndex * 3 + index
                        return (
                            <PlayerAvatar
                                key={item.token}
                                name={item.name}
                                img={item.img}
                                isHost={actualIndex === 0}
                            />
                        )
                    })}
                </View>
            ))}
        </View>
    )
}