/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./App.tsx",
    "./app/**/*.{ts,tsx}",
  ],
  presets: [require("nativewind/preset")],
  // app 100% en thème clair (aucune classe `dark:` utilisée) : "media" par
  // défaut fait planter react-native-css-interop sur web (son propre
  // MutationObserver d'init appelle colorScheme.set en mode "media", ce
  // qu'il interdit lui-même — cf. node_modules/react-native-css-interop/.../
  // color-scheme.ts). "class" évite ce chemin, sans effet visuel ici.
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
        // IMPORTANT: les couleurs doivent être synchronisées avec app/core/constants/colors.constants.ts
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
