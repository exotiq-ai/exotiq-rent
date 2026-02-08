import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Primary
        'gulf-blue': '#6EC1E4',

        // Foundation
        'deep-black': '#000000',
        'jet-grey': '#1B1B1B',
        'pure-white': '#FFFFFF',

        // Supporting
        'metallic-silver': '#C0C0C0',
        'graphite': '#3A3A3A',
        'midnight-blue': '#0A1929',

        // Marketplace Colors
        'exo-bg': '#0B0B0F',
        'exo-bg-alt': '#111118',
        'exo-card': '#161622',
        'exo-card-hover': '#1C1C2E',
        'exo-teal': '#6EC1E4',
        'exo-teal-hover': '#8AD0EA',
        'exo-gold': '#C9A84C',
        'exo-text': '#F0F0F5',
        'exo-muted': '#8888A0',
        'exo-subtle': '#555570',
        'exo-star': '#F5C842',
        'exo-success': '#2ECC71',
        'exo-error': '#E74C3C',
      },
      fontFamily: {
        sans: ['system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        dfaalt: ['"Dfaalt"', 'sans-serif'],
        mont: ['"Montserrat"', 'sans-serif'],
      },
      letterSpacing: {
        'tight-exotiq': '-0.02em',
        'wide-exotiq': '0.20em',
      },
    },
  },
  plugins: [],
};
export default config;
