import type { Config } from "tailwindcss";
// The palette is defined once, in components/browse/tokens.ts (MP-15). Relative
// path on purpose: Tailwind loads this file with its own TS loader, not webpack,
// so the `@/` alias does not resolve here.
import { tone } from "./components/browse/tokens";

const config: Config = {
  // MP-11 review: every hover: utility compiles under @media (hover: hover), so a
  // tap on a phone never triggers the card lift, the photo zoom or chip hover
  // and leaves it stuck until the next touch.
  future: { hoverOnlyWhenSupported: true },
  content: [
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      // bg-ground, text-muted, border-line2, ring-gold/60 ... (keys as in `tone`).
      colors: {
        ...tone,
        /* LEGACY:begin referenced only by app/globals.css @apply (body background and
           text, site-wide scrollbar track and thumb); retire with the marketplace
           mockup (T-2) */
        "deep-black": "#000000",
        "jet-grey": "#1B1B1B",
        "pure-white": "#FFFFFF",
        graphite: "#3A3A3A",
        /* LEGACY:end */
      },
      // One type scale, paired line-heights (MP-15). Order matters: Tailwind emits
      // these in this order, so when two steps meet on one element the larger wins.
      fontSize: {
        micro: ["10px", { lineHeight: "1.4" }],
        label: ["11px", { lineHeight: "1.45" }],
        "body-sm": ["13px", { lineHeight: "1.5" }],
        body: ["15px", { lineHeight: "1.5" }],
        "body-lg": ["16px", { lineHeight: "1.5" }],
        "title-sm": ["18px", { lineHeight: "1.4" }],
        title: ["22px", { lineHeight: "1.35" }],
        heading: ["28px", { lineHeight: "1.3" }],
        display: ["36px", { lineHeight: "1.2" }],
        "display-lg": ["48px", { lineHeight: "1.1" }],
        "display-xl": ["56px", { lineHeight: "1.05" }],
      },
      fontFamily: {
        sans: ['system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        /* LEGACY:begin font-mont x23 in components/marketplace/* (the marketplace-mode
           deploy loads Montserrat through the gated <link> in app/layout.tsx); retire
           with the mockup (T-2) */
        mont: ['"Montserrat"', 'sans-serif'],
        /* LEGACY:end */
      },
    },
  },
  plugins: [],
};
export default config;
