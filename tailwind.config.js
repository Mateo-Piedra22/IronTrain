/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./components/**/*.{js,jsx,ts,tsx}", "./src/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        iron: {
          50: '#321414',
          100: '#fcfcfc',
          200: '#fafafa',
          300: '#e0e0e0',
          400: '#8d6e63',
          500: '#5d4037',
          600: '#4e342e',
          700: '#efebe9', // Borders
          800: '#ffffff', // Card BG
          900: '#fff7f1', // Main BG
          950: '#321414', // Text Main
        },
        primary: {
          DEFAULT: '#5c2e2e',
          light: '#8d6e63', // Matched src/theme.ts
          dark: '#3e1c1c',
        },
        // Semantic aliases to match src/theme.ts
        background: '#fff7f1',
        surface: '#ffffff',
        text: '#321414',
        textMuted: '#8d6e63',
        border: '#efebe9',
        
        // Standard colors
        white: '#ffffff',
        black: '#000000',
        red: '#ef4444',
        green: '#22c55e',
        yellow: '#d97706',
      },
      fontFamily: {
        mono: ['SpaceMono'],
        sans: ['System', 'sans-serif'],
      }
    },
  },
  plugins: [],
}
