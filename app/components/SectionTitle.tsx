import { View, Text } from 'react-native';

type SectionTitleProps = {
    title?: string;
    subtitle?: string;
    align?: 'left' | 'center' | 'right';
    size?: 'sm' | 'md' | 'lg' | 'xl' | 'xs';
    titleSize?: 'sm' | 'md' | 'lg' | 'xl' | 'xs';
    subtitleSize?: 'sm' | 'md' | 'lg' | 'xl' | 'xs';
    className?: string;
    titleClassName?: string;
    subtitleClassName?: string;
};

export const SectionTitle = ({
    title,
    subtitle,
    align = 'center',
    size = 'lg',
    titleSize,
    subtitleSize,
    className = '',
    titleClassName = '',
    subtitleClassName = ''
}: SectionTitleProps) => {

    const alignmentClass = {
        left: 'text-left',
        center: 'text-center',
        right: 'text-right',
    }[align];

    const sizeMapping = {
        xl: 'text-xl',
        lg: 'text-lg',
        md: 'text-md',
        sm: 'text-sm',
        xs: 'text-xs',
    };
    const finalTitleSize = titleSize ? sizeMapping[titleSize] : sizeMapping[size];
    const finalSubtitleSize = subtitleSize ? sizeMapping[subtitleSize] : (
        size === 'xl' ? sizeMapping.sm :
            size === 'lg' ? sizeMapping.md :
                size === 'md' ? sizeMapping.sm :
                    sizeMapping.xs
    );

    return (
        <View className={className}>
            {!!title && (
                <Text className={`${finalTitleSize} font-bold text-black ${alignmentClass} ${titleClassName}`}>
                    {title}
                </Text>
            )}
            {!!subtitle && (
                <Text className={`${finalSubtitleSize} text-darkgray ${alignmentClass} ${subtitleClassName}`}>
                    {subtitle}
                </Text>
            )}
        </View>
    );
};