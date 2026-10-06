/**
 * Drive Exotiq tokens (MP-3 / M7b; the single source since MP-15).
 *
 * `tone` is the palette, written here and nowhere else: tailwind.config.ts
 * spreads it into the theme as colour names (the keys below), app/globals.css
 * mirrors it as CSS variables, and inline styles read tone.<key>. The eleven
 * type steps (micro to display-xl) live in tailwind.config.ts. (No utility is
 * quoted in these comments: Tailwind scans them.) Brand: Drive Exotiq (decision
 * 2026-08-21). Verified blue is the Exotiq mark's accent, reserved for the
 * Verified badge only.
 */
export const tone = {
  ground: '#06070a',
  panel: '#0D0F14',
  surface: '#161922',
  surface2: '#1E2230',
  field: '#10131A',
  line: '#2A2E3A',
  line2: '#3A3F4D',
  ink: '#F0F2F5',
  muted: '#9BA1B0',
  faint: '#848A9A',
  gold: '#C8A664',
  goldInk: '#1A1308',
  verified: '#6EC1E4',
  warn: '#FFB84D',
  danger: '#F87171',
  goldWash: '#14130F',
  shareGround: '#0B0D12',
  dim: '#3D4250',
  dim2: '#5C6272',
  inkSoft: '#D7DAE0',
} as const;

export const serifFamily = 'var(--font-drive-newsreader), Georgia, serif';

/**
 * Tracked caps, two recipes (MP-12): thirteen size/tracking pairs had grown
 * across the gold pages. `eyebrow` for section and page eyebrows and nav
 * (11px), `microLabel` for field labels, pills, captions and counts (10px).
 * Colour is applied at the call site.
 */
export const eyebrowClassName = 'text-label uppercase tracking-[0.2em]';
export const microLabelClassName = 'text-micro uppercase tracking-[0.16em]';

/**
 * The display-type recipe every headline on the booking surfaces uses, the
 * one place it is written (MP-15: HTitle and the flow heading spread it).
 * Newsreader loads without its optical-size axis today, so 'opsz' 32 is inert
 * until fonts.ts asks for the axis (a separate decision).
 */
export const serifStyle = { fontFamily: serifFamily, fontWeight: 500, letterSpacing: '-0.014em', fontVariationSettings: "'opsz' 32" } as const;

/**
 * The display recipe for page titles at 36–56px: tighter than body headings
 * (MP-12). Its optical size is its own: 'normal' keeps the titles exactly as
 * they render today (auto optical sizing) rather than inheriting 'opsz' 32.
 */
export const displaySerifStyle = { ...serifStyle, letterSpacing: '-0.02em', fontVariationSettings: 'normal' } as const;

/**
 * A sticky column under the 64px site bar (MP-12): the bar is sticky on
 * every desktop page now, so anything that sticks must clear it and stay
 * inside the viewport with its own scroll.
 */
export const stickyBelowBarClassName = 'lg:sticky lg:top-24 lg:max-h-[calc(100dvh-7rem)] lg:overflow-y-auto lg:[scrollbar-width:thin]';

/** Page container shared by header, hero, grid and footer. */
export const containerClassName = 'mx-auto w-full max-w-[1200px] px-4 sm:px-6 lg:px-8';

/**
 * The lit ground (MP-11). The booking frame declared this vignette as one
 * background utility whose value ended in a colour layer; Tailwind typed
 * the whole value as a colour and emitted an invalid background-color,
 * which browsers drop — so the desktop storefront sat on the body's #000
 * and nobody ever saw the glow. Two utilities: the colour, then the image
 * layers. (The old value is not quoted here on purpose: Tailwind scans
 * comments too and would emit the junk rule again.)
 */
export const groundClassName =
  'bg-ground bg-[image:radial-gradient(900px_560px_at_18%_-10%,rgba(200,166,100,0.07),transparent_58%),radial-gradient(760px_520px_at_90%_110%,rgba(200,166,100,0.045),transparent_60%)]';

/**
 * The same card as a wrapper (MP-14): the card's link and its heart button
 * are siblings inside it, so a real <button> never nests in an <a>. Hover
 * lift on the wrapper; the keyboard ring follows the link inside via :has().
 */
export const cardShellClassName =
  'relative overflow-hidden rounded-2xl border border-line bg-surface transition-[transform,border-color,box-shadow] duration-300 ease-out ' +
  'hover:-translate-y-1 hover:border-line2 hover:shadow-[0_18px_40px_-18px_rgba(0,0,0,.75)] ' +
  'has-[a:focus-visible]:ring-2 has-[a:focus-visible]:ring-gold/70 has-[a:focus-visible]:ring-offset-2 has-[a:focus-visible]:ring-offset-ground ' +
  'motion-reduce:transition-none motion-reduce:hover:translate-y-0';

/** The card recipe (MP-11): both cards now wrap their link in the shell above, so this is the same string by construction. */
export const cardClassName = cardShellClassName;

/** Photo frame: a 1px inner hairline so a dark photo never dissolves into the card. Nothing over the car. */
export const photoFrameClassName =
  'relative aspect-[4/3] overflow-hidden bg-surface2 after:pointer-events-none after:absolute after:inset-0 after:shadow-[inset_0_0_0_1px_rgba(255,255,255,.05)]';

/** Photo: the storefront hero's slightly-low focal point, so wheels and stance stay in frame; zoom eases, and stays still under reduced motion. */
export const photoClassName =
  'object-cover object-[50%_55%] transition-transform duration-[600ms] ease-out group-hover:scale-[1.03] motion-reduce:transition-none motion-reduce:group-hover:scale-100';

/** Text, date and select fields on the gold surfaces: the Driver step's recipe, with hover and a keyboard ring. */
export const fieldClassName =
  'w-full rounded-lg border border-line bg-field px-3 py-2.5 text-body-lg text-ink outline-none transition placeholder:text-faint hover:border-line2 focus:border-gold/70 focus-visible:ring-2 focus-visible:ring-gold/60 [color-scheme:dark]';

/** A native select wearing the field recipe; pair with a ChevronDown in a `relative` wrapper. */
export const selectClassName = `${fieldClassName} appearance-none pr-9`;

/**
 * Native date input restyled as a pill (interim until MP-13's calendar
 * popover). Chromium's picker glyph is moved, invisible, over the leading
 * 28px where the CalendarDays icon sits: the icon opens the picker and the
 * month/day/year segments stay clickable and typeable (stretched over the
 * whole pill it swallowed every click). `relative` anchors it to the pill
 * whatever the wrapper. Wrap with a CalendarDays icon at left-2.5.
 */
export const datePillClassName =
  'relative h-8 rounded-full border border-line2 bg-field pl-7 pr-2.5 text-body-lg leading-none text-ink outline-none transition hover:border-faint focus-visible:ring-2 focus-visible:ring-gold/60 [color-scheme:dark] ' +
  '[&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:inset-y-0 [&::-webkit-calendar-picker-indicator]:left-0 [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:w-7 [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-0';

/**
 * The gold primary action (MP-16, D7): one recipe for every gold-filled button
 * and link, so each gets the same states. A slight lighten under the pointer,
 * a slight compress and darken on press, both still while the control is
 * disabled or marked aria-disabled (anchors never match the enabled state, so
 * the states are neutralised instead), and no compress under reduced motion.
 * Hover only applies where hover exists (the config's hoverOnlyWhenSupported).
 * Call sites keep their own size, radius and width.
 */
export const ctaClassName =
  'bg-gold text-goldInk transition hover:brightness-110 active:scale-[0.98] active:brightness-95 ' +
  'disabled:hover:brightness-100 disabled:active:scale-100 disabled:active:brightness-100 ' +
  'aria-disabled:hover:brightness-100 aria-disabled:active:scale-100 aria-disabled:active:brightness-100 ' +
  'motion-reduce:transition-none motion-reduce:active:scale-100';

/** The quiet secondary beside a gold action (D3): ink on a line2 hairline, the same press, the same guards. */
export const ctaOutlineClassName =
  'border border-line2 text-ink transition hover:border-faint hover:bg-surface2 active:scale-[0.98] ' +
  'disabled:hover:border-line2 disabled:hover:bg-transparent disabled:active:scale-100 ' +
  'aria-disabled:hover:border-line2 aria-disabled:hover:bg-transparent aria-disabled:active:scale-100 ' +
  'motion-reduce:transition-none motion-reduce:active:scale-100';

/**
 * The pinned bar at the foot of a phone surface (MP-16, D8; in flow since MP-28):
 * the booking flow footer, the vehicle page Book bar and the storefront Call bar
 * share everything here, and each call site adds only its own visibility and the
 * pinned-bar hook. The bar is the last child of the frame's column, after its
 * scroller, so its panel IS the bottom of the frame: nothing exists beneath it,
 * and the scroller ends at its top edge whatever the bar holds. The safe area is
 * inside the bar's own bottom padding, never an outer offset. It is that
 * surface's one elevated element.
 */
export const stickyBarClassName =
  'relative z-10 shrink-0 border-t border-line bg-panel px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 shadow-[0_-24px_42px_rgba(13,15,20,.96)]';

/** The one floating card on a surface that has no sticky bar there (vehicle aside from lg, the browse filters popover, the share card). Neutral, never gold. */
export const elevatedClassName = 'shadow-[0_24px_60px_-20px_rgba(0,0,0,.8)]';

/** The daily rate on a card: one figure recipe for browse and storefront, unit beside it at a colour that still reads (5:1). */
export const priceClassName = 'shrink-0 text-title-sm font-medium leading-none text-gold';
export const priceUnitClassName = 'ml-1.5 text-micro font-normal uppercase tracking-[0.16em] text-faint';
