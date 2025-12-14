/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./App.tsx",
    "./app/**/*.{ts,tsx}",
  ],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      fontSize: {
        'xl': '48px',
        'lg': '40px',
        'md': '30px',
        'sm': '18px',
        'xs': '14px',
      },
      colors: {

        // mains
        // IMPORTANT: Doit également être changé pour l'icone dans app/components/Button.tsx
        dark: '#020202',
        white: '#FAFAFA', 
        offwhite: '#F2F2F2',
        darkgray: '#474747',
        disconnect: '#C31A1A',

        // primary
        primary: '#9622E0',

        // games
        guesstracks: '#9622E0',
        blindtest: '#E07422',

        // plateformes
        // IMPORTANT: Doit également être changé pour l'icone dans app/components/Button.tsx
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
