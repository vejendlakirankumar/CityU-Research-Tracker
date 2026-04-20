/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brand: {
          50:  '#eef2f7',
          100: '#d5deec',
          200: '#a8bcd9',
          300: '#7b9bc6',
          400: '#4e79b3',
          500: '#2f5a96',
          600: '#1e4080',
          700: '#162f5e',
          800: '#0d1f3c',
          900: '#070f1e',
        },
      },
    },
  },
  plugins: [],
}
