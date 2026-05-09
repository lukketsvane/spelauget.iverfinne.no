import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        pixel: ['var(--font-pixel)', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};

export default config;
