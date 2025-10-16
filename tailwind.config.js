/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./App.tsx",
    "./app/**/*.{ts,tsx}",
  ],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors:{
        spotify:{
          primary:'#1db954',
          dark:'#121212',
          lightdark:'#212121',
          lightgrey:'#b3b3b3',
          gray:'#535353',
        },
        apple:{
          primary:'#ff0436',
          secondary:'#ff4e6b',
          white:'#ffffff',
        },
        deezer:{
          primary:'#a238ff',
          secondary:'#0f0d13',
          white:'#ffffff',
        }
      }
    },
  },
  plugins: [],
}