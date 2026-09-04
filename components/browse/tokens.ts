/**
 * Drive Exotiq browse tokens (MP-3 / M7b).
 *
 * Extracted from what the booking flow actually renders — not a repo-wide
 * refactor of its hex literals. New marketplace code reads these; the flow
 * keeps its literals until a dedicated pass. Brand: Drive Exotiq (decision
 * 2026-08-21). Verified blue is the Exotiq mark's accent, reserved for the
 * Verified badge only.
 */
export const tone = {
  ground: '#06070a',
  panel: '#0D0F14',
  surface: '#161922',
  surface2: '#1E2230',
  line: '#2A2E3A',
  ink: '#F0F2F5',
  muted: '#9BA1B0',
  faint: '#848A9A',
  gold: '#C8A664',
  verified: '#6EC1E4',
} as const;

export const serifFamily = 'var(--font-drive-newsreader), Georgia, serif';

/** The display-type recipe every headline on the booking surfaces uses. */
export const serifStyle = { fontFamily: serifFamily, fontWeight: 500, letterSpacing: '-0.014em' } as const;

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
  'bg-[#06070a] bg-[image:radial-gradient(900px_560px_at_18%_-10%,rgba(200,166,100,0.07),transparent_58%),radial-gradient(760px_520px_at_90%_110%,rgba(200,166,100,0.045),transparent_60%)]';

/**
 * The same card as a wrapper (MP-14): the card's link and its heart button
 * are siblings inside it, so a real <button> never nests in an <a>. Hover
 * lift on the wrapper; the keyboard ring follows the link inside via :has().
 */
export const cardShellClassName =
  'relative overflow-hidden rounded-2xl border border-[#2A2E3A] bg-[#161922] transition-[transform,border-color,box-shadow] duration-300 ease-out ' +
  'hover:-translate-y-1 hover:border-[#C8A664]/45 hover:shadow-[0_18px_40px_-18px_rgba(0,0,0,.75),0_10px_30px_-16px_rgba(200,166,100,.22)] ' +
  'has-[a:focus-visible]:ring-2 has-[a:focus-visible]:ring-[#C8A664]/70 has-[a:focus-visible]:ring-offset-2 has-[a:focus-visible]:ring-offset-[#06070a] ' +
  'motion-reduce:transition-none motion-reduce:hover:translate-y-0';

/** The card recipe (MP-11): both cards now wrap their link in the shell above, so this is the same string by construction. */
export const cardClassName = cardShellClassName;

/** Photo frame: a 1px inner hairline so a dark photo never dissolves into the card. Nothing over the car. */
export const photoFrameClassName =
  'relative aspect-[4/3] overflow-hidden bg-[#1E2230] after:pointer-events-none after:absolute after:inset-0 after:shadow-[inset_0_0_0_1px_rgba(255,255,255,.05)]';

/** Photo: the storefront hero's slightly-low focal point, so wheels and stance stay in frame; zoom eases, and stays still under reduced motion. */
export const photoClassName =
  'object-cover object-[50%_55%] transition-transform duration-[600ms] ease-out group-hover:scale-[1.03] motion-reduce:transition-none motion-reduce:group-hover:scale-100';

/** Text, date and select fields on the gold surfaces: the Driver step's recipe, with hover and a keyboard ring. */
export const fieldClassName =
  'w-full rounded-lg border border-[#2A2E3A] bg-[#10131A] px-3 py-2.5 text-[13px] text-[#F0F2F5] outline-none transition placeholder:text-[#848A9A] hover:border-[#3A3F4D] focus:border-[#C8A664]/70 focus-visible:ring-2 focus-visible:ring-[#C8A664]/60 [color-scheme:dark]';

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
  'relative h-8 rounded-full border border-[#3A3F4D] bg-[#10131A] pl-7 pr-2.5 text-[12px] leading-none text-[#F0F2F5] outline-none transition hover:border-[#C8A664]/40 focus-visible:ring-2 focus-visible:ring-[#C8A664]/60 [color-scheme:dark] ' +
  '[&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:inset-y-0 [&::-webkit-calendar-picker-indicator]:left-0 [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:w-7 [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-0';

/** The daily rate on a card: one figure recipe for browse and storefront, unit beside it at a colour that still reads (5:1). */
export const priceClassName = 'shrink-0 text-[18px] font-medium leading-none text-[#C8A664]';
export const priceUnitClassName = 'ml-1.5 text-[10px] font-normal uppercase tracking-[0.16em] text-[#848A9A]';
