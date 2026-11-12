import type { Config } from 'tailwindcss';
import colors from 'tailwindcss/colors';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Palette: Cream #F3EEE3, Ink Black #111111, Burnt Orange #D9541E.
        gray: colors.stone,
        // "leaf" is the ink scale: 800 is Ink Black, the light steps are warm cream tints.
        leaf: {
          50: '#f8f5ee',
          100: '#efe9dc',
          200: '#e0d8c7',
          300: '#c9bfab',
          400: '#9c9382',
          500: '#6b655a',
          600: '#45413a',
          700: '#2a2825',
          800: '#111111',
          900: '#000000',
        },
        // "haldi" is the burnt-orange accent. 500 is the brand colour; 600 is the
        // button fill (white text passes 4.5:1); 700 is for small text on cream.
        haldi: {
          50: '#fdf1ea',
          100: '#f9dccb',
          400: '#e5713f',
          500: '#d9541e',
          600: '#c94a17',
          700: '#a83d12',
        },
        // "soil" is cream.
        soil: {
          50: '#f3eee3',
          100: '#e9e2d3',
          500: '#9a8f79',
          700: '#6b6252',
        },
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'var(--font-deva)', 'system-ui', 'sans-serif'],
        serif: ['var(--font-serif)', 'Georgia', 'Times New Roman', 'serif'],
      },
      boxShadow: { card: '0 1px 2px rgba(17,17,17,0.04), 0 8px 24px -12px rgba(17,17,17,0.12)' },
      minHeight: { touch: '48px' },
      minWidth: { touch: '48px' },
    },
  },
  plugins: [],
};

export default config;
