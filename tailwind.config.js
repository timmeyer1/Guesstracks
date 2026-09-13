/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./App.tsx",
    "./app/**/*.{ts,tsx}",
  ],
  presets: [require("nativewind/preset")],
  // l'app est full thème clair, on utilise aucune classe dark. Le mode
  // "media" par défaut fait planter react-native-css-interop sur web,
  // dcp on met "class" à la place, ça change rien visuellement ici.
  darkMode: 'class',
  theme: {
    extend: {
      boxShadow: {
        card: '0 4px 12px rgba(0,0,0,0.06)',
      },
      fontSize: {
        'xl': '48px',
        'lg': '40px',
        'md': '30px',
        'sm': '18px',
        'xs': '14px',
      },
      colors: {
        // important : faut garder ça synchro avec app/core/constants/colors.constants.ts
        // mains
        dark: '#020202',
        white: '#FAFAFA',
        offwhite: '#F2F2F2',
        darkgray: '#474747',
        disconnect: '#C31A1A',

        // primary
        primary: '#9622E0',

        // games
        who_liked: '#9622E0',
        blindtest: '#E07422',

        // plateformes
        spotify: '#1ED760',
        apple_music: '#FF4E6B',
        deezer: '#A238FF',
        youtube_music: '#FF0000',

        // theme
        text: {
          primary: '#FAFAFA',
          secondary: '#888888',
        },

        error: '#ff4444',
        success: '#00c853',
      },

      backgroundImage: {
        'gradient-primary': 'linear-gradient(to right, #9622E0, #D11FEC)',
      }
    },
  },
  plugins: [],
}
