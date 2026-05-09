import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        pixel: ['var(--font-pixel)', 'system-ui', 'sans-serif'],
      },
      keyframes: {
        // Pop-in animation for the inventory key when first acquired.
        // Scales from 0 with a slight overshoot before settling.
        'key-pop': {
          '0%': { transform: 'scale(0) rotate(-25deg)', opacity: '0' },
          '60%': { transform: 'scale(1.25) rotate(8deg)', opacity: '1' },
          '100%': { transform: 'scale(1) rotate(0deg)', opacity: '1' },
        },
        // Slow opening fade for New Game — eases the player from black
        // into the moonlit clearing. Long duration so the music intro
        // and the visuals breathe together.
        'fade-from-black': {
          '0%': { opacity: '1' },
          '100%': { opacity: '0' },
        },
      },
      animation: {
        'key-pop': 'key-pop 520ms cubic-bezier(0.34, 1.56, 0.64, 1) both',
        'fade-from-black': 'fade-from-black 2800ms ease-out forwards',
      },
    },
  },
  plugins: [],
};

export default config;
