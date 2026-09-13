export const COLORS = {
    // important : faut garder ces couleurs en phase avec tailwind.config.js
    // mains
    dark: '#020202',
    white: '#FAFAFA',
    offwhite: '#F2F2F2',
    darkgray: '#474747',
    disconnect: '#C31A1A',

    // primary
    primary: '#9622E0',

    // jeux
    who_liked: '#9622E0',
    blindtest: '#E07422',

    // plateformes
    spotify: '#1ED760',
    apple_music: '#FF4E6B',
    deezer: '#A238FF',
    youtube_music: '#FF0000',

    // status
    error: '#ff4444',
    success: '#00c853',
} as const

export type ButtonVariant = 'white' | 'dark' | 'spotify' | 'deezer' | 'apple_music' | 'youtube_music'
export type GameMode = 'who_liked' | 'blindtest'