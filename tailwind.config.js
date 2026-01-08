/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./components/**/*.{js,jsx,ts,tsx}", "./src/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        iron: {
          50: '#f8fafc',
          100: '#f1f5f9',
          200: '#e2e8f0',
          300: '#cbd5e1',
          400: '#94a3b8',
          500: '#64748b',
          600: '#475569',
          700: '#334155', // Card bg
          800: '#1e293b', // Darker elements
          900: '#0f172a', // Main background
          950: '#020617', // Black
        },
        primary: {
          DEFAULT: '#fb923c', // Pastel Orange (Tailwind Orange-400)
          light: '#fdba74',   // Orange-300
          dark: '#f97316',    // Orange-500
        }
      },
      fontFamily: {
        mono: ['SpaceMono'],
        sans: ['System', 'sans-serif'],
      }
    },
  },
  plugins: [],
}
