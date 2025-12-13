export type ButtonVariant = 'white' | 'dark' | 'spotify' | 'deezer' | 'apple_music' | 'youtube_music';

export interface VariantStyle {
    textClass: string;
    iconColor: string;
    bgClass: string;
}

export const buttonVariants: Record<ButtonVariant, VariantStyle> = {
    white: {
        textClass: 'text-black',
        iconColor: '#020202',
        bgClass: 'bg-offwhite'
    },
    dark: {
        textClass: 'text-white',
        iconColor: '#FAFAFA',
        bgClass: 'bg-dark'
    },
    spotify: {
        textClass: 'text-spotify',
        iconColor: '#1ED760',
        bgClass: 'bg-offwhite'
    },
    deezer: {
        textClass: 'text-deezer',
        iconColor: '#A238FF',
        bgClass: 'bg-offwhite'
    },
    apple_music: {
        textClass: 'text-apple_music',
        iconColor: '#FF4E6B',
        bgClass: 'bg-offwhite'
    },
    youtube_music: {
        textClass: 'text-youtube_music',
        iconColor: '#FF0000',
        bgClass: 'bg-offwhite'
    },
};