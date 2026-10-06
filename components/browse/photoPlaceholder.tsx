/**
 * The loading signal for a content photo (MP-18): a dark shimmer UNDER the photograph. Render it
 * as the frame's first child, before the <Image>: the photo (position absolute, later in the DOM)
 * paints over it once it arrives, so nothing is ever drawn on the car. Only where a photo is
 * expected: a frame with no photo keeps its own placeholder and gets no shimmer.
 *
 * CSS only and server-safe (no directive, no hook). Bounded: the photo-shimmer animation in
 * tailwind.config.ts runs 7 x 1.6s and stops; still under prefers-reduced-motion. The band is
 * transparent outside its middle fifth, so start, end and reduced motion all show the frame's own
 * surface. MP-19's gallery tiles adopt this helper; MP-22's per-photo blur builds on it.
 */
export const photoShimmerClassName =
  'pointer-events-none absolute inset-0 bg-gradient-to-r from-transparent from-40% via-ink/[0.06] via-50% to-transparent to-60% bg-[length:300%_100%] animate-photo-shimmer motion-reduce:animate-none';

export function PhotoShimmer() {
  return <span aria-hidden="true" data-photo-shimmer="" className={photoShimmerClassName} />;
}
