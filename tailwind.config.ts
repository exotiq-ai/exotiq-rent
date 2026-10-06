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
      // One type scale, paired line-heights (MP-15), listed small to large. This order
      // does NOT decide which step wins when two meet on one element: Tailwind 3.4.19
      // emits one plugin's utilities sorted by class name, so the alphabetically later
      // step wins (title beats heading and display). To pair two steps on one element
      // (a component's own step plus a caller's), give the caller's under a breakpoint
      // variant, e.g. max-lg: and lg:, which are emitted after base utilities.
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
      // The content-photo loading shimmer (MP-18, components/browse/photoPlaceholder.tsx): a soft
      // band sweeping under the photo. Bounded: 7 runs of 1.6s (11.2s) and then still, so a photo
      // that never arrives does not shimmer forever. No fill mode: it ends on the neutral frame.
      keyframes: {
        photoShimmer: {
          "0%": { backgroundPosition: "100% 0" },
          "100%": { backgroundPosition: "0% 0" },
        },
      },
      animation: {
        "photo-shimmer": "photoShimmer 1.6s ease-in-out 7",
      },
    },
  },
  plugins: [],
};
export default config;
