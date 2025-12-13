import { View, Text } from 'react-native';

type SectionTitleProps = {
    title?: string;
    subtitle?: string;
    align?: 'left' | 'center' | 'right';
    size?: 'sm' | 'md' | 'lg' | 'xl' | 'xs';
    className?: string;
    titleClassName?: string;
    subtitleClassName?: string;
};

export const SectionTitle = ({
    title,
    subtitle,
    align = 'center',
    size = 'lg',
    className = '',
    titleClassName = '',
    subtitleClassName = ''
}: SectionTitleProps) => {

    // Mapping pour l'alignement
    const alignmentClass = {
        left: 'text-left',
        center: 'text-center',
        right: 'text-right',
    }[align];

    // Mapping pour les tailles
    const sizeClasses = {
        xl: { title: 'text-xl', subtitle: 'text-sm' },
        lg: { title: 'text-lg', subtitle: 'text-md' },
        md: { title: 'text-md', subtitle: 'text-sm' },
        sm: { title: 'text-sm', subtitle: 'text-xs' },
        xs: { title: 'text-xs', subtitle: 'text-xs' },
    }[size];

    return (
        <View className={className}>
            {title && (
                <Text className={`${sizeClasses.title} font-bold text-black ${alignmentClass} ${titleClassName}`}>
                    {title}
                </Text>
            )}
            {subtitle && (
                <Text className={`${sizeClasses.subtitle} text-darkgray ${alignmentClass} ${subtitleClassName}`}>
                    {subtitle}
                </Text>
            )}
        </View>
    );
};