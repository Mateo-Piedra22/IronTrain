import type { Config } from 'tailwindcss';

export default {
  content: ['./app/**/*.{ts,tsx}', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        iron: {
          50: '#fff7f1',
          100: '#ffe8d8',
          200: '#fed1b0',
          300: '#fbb277',
          400: '#f98c3a',
          500: '#f97316',
          600: '#ea580c',
          700: '#c2410c',
          800: '#9a3412',
          900: '#7c2d12',
          950: '#431407'
        }
      }
    },
  },
  plugins: [],
} satisfies Config;

