import { View, Text, Image } from 'react-native';
import { SectionTitle } from './SectionTitle';
import { PlayerAvatar } from './lobby/PlayerAvatar';

type UserProfileCardProps = {
    name?: string;
    img?: string | null;
    totalTracks: number;
};

export const UserProfileCard = ({ name, img, totalTracks }: UserProfileCardProps) => {
    const getSubtitleSize = (name: string | undefined): 'sm' | 'md' | 'lg' | 'xl' | 'xs' => {
        if (!name) return 'md';
        const length = name.length;

        if (length <= 12) return 'md';
        if (length <= 19) return 'sm';
        if (length <= 25) return 'xs';
        return 'xs';
    };

    const truncateIfNeeded = (name: string | undefined, maxLength: number = 30) => {
        if (!name) return '';
        if (name.length <= maxLength) return name;
        return name.substring(0, maxLength) + '...';
    };

    const subtitleSize = getSubtitleSize(name);
    const displayName = truncateIfNeeded(name);

    return (
        <View className="flex items-center my-12">

            <View className="flex flex-row gap-8 items-center">

                {/* <View className="w-24 h-24 rounded-full bg-black items-center justify-center mb-4 gap-2">
                    {img ? (
                        <Image
                            style={{ width: 96, height: 96, borderRadius: 48 }}
                            source={{ uri: img }}
                        />
                    ) : (
                        <Text className="text-white text-lg">👤</Text>
                    )}
                </View> */}

                <PlayerAvatar
                    name={''}
                    size='lg'
                    img={img ?? undefined}
                    isHost={false}
                />

                <View className="flex-1 max-w-[220px]">
                    <SectionTitle
                        title="Bienvenue"
                        align="left"
                        titleSize="lg"
                        subtitleSize={subtitleSize}
                        subtitle={displayName}
                        subtitleClassName="capitalize"
                    />
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