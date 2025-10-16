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
        '5xl': '48px'
      },
      colors: {
        primary: {
          start: '#9622e0',
          end: '#d11fec',
        },
        background: '#1e1e1e',
        white: '#eeeeee',

        text: {
          primary: '#eeeeee',
          secondary: '#888888',
        },

        error: '#ff4444',
        success: '#00c853',

        spotify: {
          primary: '#1db954',
          dark: '#121212',
          lightdark: '#212121',
          lightgrey: '#b3b3b3',
          gray: '#535353',
        },
        apple: {
          primary: '#ff0436',
          secondary: '#ff4e6b',
          white: '#ffffff',
        },
        deezer: {
          primary: '#a238ff',
          secondary: '#0f0d13',
          white: '#ffffff',
        }
      },

      backgroundImage: {
        'gradient-primary': 'linear-gradient(to right, #9622e0, #d11fec)',
      }
    },
  },
  plugins: [],
}