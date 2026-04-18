/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['"Fredoka One"', '"Baloo 2"', 'system-ui', 'sans-serif'],
        sans: ['"Baloo 2"', 'system-ui', 'sans-serif'],
      },
      colors: {
        // Light blue "sky" brand palette (matches the main app vibe)
        sky: {
          50: '#f0f9ff',
          100: '#e0f2fe',
          200: '#bae6fd',
          300: '#7dd3fc',
          400: '#38bdf8',
          500: '#0ea5e9',
          600: '#0284c7',
          700: '#0369a1',
          800: '#075985',
          900: '#0c4a6e',
          950: '#0b3a56',
        },
        // Gold / sunshine yellow accents
        gold: {
          50: '#fffdea',
          100: '#fff6c2',
          200: '#ffec89',
          300: '#ffdc45',
          400: '#ffce1a',
          500: '#ffb703',
          600: '#e09400',
          700: '#b36f02',
          800: '#92560a',
          900: '#78460d',
        },
      },
      boxShadow: {
        card: '0 10px 30px -12px rgba(3, 105, 161, 0.25)',
        gold: '0 10px 25px -10px rgba(255, 183, 3, 0.55)',
      },
    },
  },
  plugins: [],
};
