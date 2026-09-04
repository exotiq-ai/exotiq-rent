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
 * `bg-[radial-gradient(...),#06070a]` value, which Tailwind 3.4 could not
 * classify (a trailing colour layer is not an image) and dropped — so the
 * desktop storefront sat on the body's #000 and nobody ever saw the glow.
 * Two utilities: the colour, then the image layers.
 */
export const groundClassName =
  'bg-[#06070a] bg-[image:radial-gradient(900px_560px_at_18%_-10%,rgba(200,166,100,0.07),transparent_58%),radial-gradient(760px_520px_at_90%_110%,rgba(200,166,100,0.045),transparent_60%)]';

/** Card hover: a 4px lift with a deep shadow and a faint gold rim, keyboard ring to match (MP-11). */
export const cardClassName =
  'overflow-hidden rounded-2xl border border-[#2A2E3A] bg-[#161922] transition-[transform,border-color,box-shadow] duration-300 ease-out ' +
  'hover:-translate-y-1 hover:border-[#C8A664]/45 hover:shadow-[0_18px_40px_-18px_rgba(0,0,0,.75),0_10px_30px_-16px_rgba(200,166,100,.22)] ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C8A664]/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#06070a] ' +
  'motion-reduce:transition-none motion-reduce:hover:translate-y-0';

/** Photo frame: a 1px inner hairline so a dark photo never dissolves into the card. Nothing over the car. */
export const photoFrameClassName =
  'relative aspect-[4/3] overflow-hidden bg-[#1E2230] after:pointer-events-none after:absolute after:inset-0 after:shadow-[inset_0_0_0_1px_rgba(255,255,255,.05)]';

/** Photo: the storefront hero's slightly-low focal point, so wheels and stance stay in frame; zoom eases, and stays still under reduced motion. */
export const photoClassName =
  'object-cover object-[50%_55%] transition-transform duration-[600ms] ease-out group-hover:scale-[1.03] motion-reduce:transition-none motion-reduce:group-hover:scale-100';

/** Text, date and select fields on the gold surfaces: the Driver step's recipe, with hover and a keyboard ring. */
export const fieldClassName =
  'w-full rounded-lg border border-[#2A2E3A] bg-[#10131A] px-3 py-2.5 text-[13px] text-[#F0F2F5] outline-none transition placeholder:text-[#5C6272] hover:border-[#3A3F4D] focus:border-[#C8A664]/70 focus-visible:ring-2 focus-visible:ring-[#C8A664]/60 [color-scheme:dark]';

/** A native select wearing the field recipe; pair with a ChevronDown in a `relative` wrapper. */
export const selectClassName = `${fieldClassName} appearance-none pr-9`;

/** Native date input restyled as a pill (interim until MP-13's calendar popover): the browser glyph is stretched over the whole pill and hidden, so tapping anywhere opens the picker; a CalendarDays icon leads. */
export const datePillClassName =
  'h-8 min-w-[8.5rem] rounded-full border border-[#3A3F4D] bg-[#10131A] pl-8 pr-3 text-[12px] leading-none text-[#F0F2F5] outline-none transition hover:border-[#C8A664]/40 focus-visible:ring-2 focus-visible:ring-[#C8A664]/60 [color-scheme:dark] ' +
  '[&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:inset-0 [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-0';
