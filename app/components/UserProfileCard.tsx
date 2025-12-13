import { View, Text, Image } from 'react-native';
import { SectionTitle } from './SectionTitle';

type UserProfileCardProps = {
    name?: string;
    img?: string | null;
    totalTracks: number;
};

export const UserProfileCard = ({ name, img, totalTracks }: UserProfileCardProps) => {
    return (
        <View className="flex items-center my-12">

            <View className="flex flex-row gap-8 items-center">

                <View className="w-24 h-24 rounded-full bg-black items-center justify-center mb-4 gap-2">
                    {img ? (
                        <Image
                            style={{ width: 96, height: 96, borderRadius: 48 }}
                            source={{ uri: img }}
                        />
                    ) : (
                        <Text className="text-white text-lg">👤</Text>
                    )}
                </View>
                <View>
                    <SectionTitle
                        title="Bienvenue"
                        align="left"
                        
                    />
                    <Text className="text-lg text-black mb-3 capitalize">
                        {name}
                    </Text>
                </View>


            </View>

            <View className="flex-row justify-between items-center gap-3 mb-1">
                <Text className="text-base text-darkgray bg-offwhite p-2 rounded-2xl">
                    Connecté via Spotify
                </Text>
                <View className="w-1.5 h-1.5 rounded-full bg-gray-600" />
                <Text className="text-base text-darkgray bg-offwhite p-2 rounded-2xl">
                    {totalTracks} titres likés
                </Text>
            </View>
        </View>
    );
};