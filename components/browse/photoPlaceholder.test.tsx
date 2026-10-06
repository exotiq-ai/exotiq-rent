// MP-18 AC6: while a content photo loads its frame shows a dark shimmer, never a still empty box.
// One helper (photoPlaceholder.tsx), CSS only, an aria-hidden element BEFORE the <Image> so the
// photograph paints over it and nothing is ever drawn on the car; bounded (<= 12 s) and still
// under reduced motion. Structure is asserted (DOM order, attributes), never class strings.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import config from '../../tailwind.config';
import { compileWith, stripComments } from '../../tests/design/lib/scan.mjs';
import { type El, classes, elements, parseHtml } from '../../tests/fees/fixtures';
import { getMockPublicTeamStorefront } from '../../domain/booking/mockService';
import type { MarketplaceListing } from '../../domain/booking/publicContracts';
import { ListingCard } from './ListingCard';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const read = (rel: string) => readFileSync(join(ROOT, rel), 'utf8');
type Helper = { PhotoShimmer?: () => JSX.Element; photoShimmerClassName?: string };
/** Loaded per test, so a missing helper fails each test for its own reason instead of the whole file. */
const loadHelper = async (): Promise<Helper> => (await import('./photoPlaceholder').catch(() => ({}))) as Helper;

async function listing(heroImage?: string): Promise<MarketplaceListing> {
  const storefront = await getMockPublicTeamStorefront('desert-exotic-rentals');
  const vehicle = { ...storefront!.vehicles[0], ...(heroImage === undefined ? {} : { heroImage }) };
  return { team: storefront!.team, vehicle, photoCount: vehicle.photos.length };
}
const isShimmer = (e: El) => 'data-photo-shimmer' in e.attrs;
const childEls = (e: El) => e.children.filter((c): c is El => typeof c !== 'string');

/** The base `<Image …>` opening tags of the photo frames MP-18 decorates: their props must not move. */
const IMAGE_TAGS: [string, string][] = [
  ['components/browse/ListingCard.tsx', '<Image src={vehicle.heroImage} alt={vehicle.name} fill priority={priority} sizes={sizes} className={photoClassName} />'],
  ['app/[operatorSlug]/page.tsx', '<Image src={heroVehicle.heroImage} alt={heroVehicle.name} fill priority sizes="(min-width: 1024px) 840px, 480px" className="object-cover object-[50%_52%]" />'],
  ['components/drive-exotiq/VehicleGallery.tsx', '<Image src={hero} alt={vehicleName} fill sizes="(min-width: 1024px) 800px, 480px" priority className="object-cover object-[50%_52%]" onError={() => markFailed(hero)} />'],
  ['components/drive-exotiq/VehicleGallery.tsx', '<Image src={photo} alt={`${shortName} photo ${index + 1}`} fill sizes="(min-width: 1024px) 160px, 128px" className="object-cover" onError={() => markFailed(photo)} />'],
];

describe('MP-18 photo loading shimmer (AC6)', () => {
  it('listing card puts the shimmer before the photo and nothing after it', async () => {
    const mod = await loadHelper();
    expect(mod.PhotoShimmer, 'components/browse/photoPlaceholder.tsx exports no PhotoShimmer').toBeTypeOf('function');
    const html = renderToStaticMarkup(<ListingCard listing={await listing()} />);
    const root = parseHtml(html);
    const shimmers = elements(root).filter(isShimmer);
    expect(shimmers).toHaveLength(1);
    const img = elements(root).find((e) => e.tag === 'img');
    expect(img).toBeDefined();
    // Same frame, shimmer first: the photo (position absolute, later in the DOM) paints over it.
    const frame = shimmers[0].parent!;
    expect(img!.parent).toBe(frame);
    const kids = childEls(frame);
    expect(kids[0]).toBe(shimmers[0]);
    expect(kids[1]).toBe(img);
    // Nothing new after the photo: only the pills that were there before (the min-rental chip).
    expect(kids.slice(2).map((k) => elements(k).map((e) => e.tag).join('>'))).toEqual(['div']);
    expect(html).toContain('-day min');
    expect(elements(root).filter((e) => classes(e).includes('animate-photo-shimmer'))).toEqual(shimmers);
  });

  it('listing card without a hero has no shimmer', async () => {
    const html = renderToStaticMarkup(<ListingCard listing={await listing('')} />);
    expect(html).toContain('No photos yet');
    expect(html).not.toContain('data-photo-shimmer');
    expect(html).not.toContain('<img');
  });

  it('shimmer is hidden from assistive tech and bounded', async () => {
    const mod = await loadHelper();
    expect(mod.PhotoShimmer, 'components/browse/photoPlaceholder.tsx exports no PhotoShimmer').toBeTypeOf('function');
    const el = parseHtml(renderToStaticMarkup(<>{mod.PhotoShimmer!()}</>));
    const [shimmer] = elements(el).filter(isShimmer);
    expect(shimmer.attrs['aria-hidden']).toBe('true');
    expect(shimmer.children).toEqual([]);

    // Compiled with the real Tailwind config: finite iterations, total run <= 12 s, still under reduced motion.
    const cls = (mod.photoShimmerClassName ?? '').split(/\s+/).filter(Boolean);
    expect(cls).toContain('animate-photo-shimmer');
    expect(cls).toContain('motion-reduce:animate-none');
    const { css, decls } = await compileWith(config, cls);
    const animation = decls('animate-photo-shimmer').find((d) => d.startsWith('animation:'));
    const m = /^animation:photoshimmer ([\d.]+)s [a-z-]+ (\d+)$/.exec(animation ?? '');
    expect(m, `animation is "${animation}"`).not.toBeNull();
    const [duration, count] = [Number(m![1]), Number(m![2])];
    expect(Number.isInteger(count) && count >= 1).toBe(true);
    expect(duration * count).toBeLessThanOrEqual(12);
    expect(css).toMatch(/@keyframes photoShimmer/);
    expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\)\s*\{\s*\.motion-reduce\\:animate-none\s*\{\s*animation: none/);
    // An infinite count is caught by the same parse.
    expect(/^animation:photoshimmer ([\d.]+)s [a-z-]+ (\d+)$/.exec('animation:photoshimmer 1.6s ease-in-out infinite')).toBeNull();

    // CSS only: no client directive in the helper, no flat-colour blur anywhere it is applied.
    const src = read('components/browse/photoPlaceholder.tsx');
    expect(stripComments(src)).not.toMatch(/['"]use client['"]/);
    for (const rel of ['components/browse/photoPlaceholder.tsx', 'components/browse/ListingCard.tsx', 'components/drive-exotiq/VehicleGallery.tsx', 'app/[operatorSlug]/page.tsx']) {
      expect(stripComments(read(rel)), rel).not.toMatch(/blurDataURL|placeholder\s*=\s*["{']?\s*["']?blur/);
    }
  });

  it('storefront hero and vehicle gallery put the shimmer before each photo and keep its props', () => {
    for (const [rel, tag] of IMAGE_TAGS) {
      const src = stripComments(read(rel));
      const at = src.indexOf(tag);
      expect(at, `${rel}: the <Image> props changed`).toBeGreaterThanOrEqual(0);
      // The element right before this <Image> is the shimmer: no other element opens between them.
      const before = src.slice(Math.max(0, at - 200), at);
      const last = before.lastIndexOf('<PhotoShimmer />');
      expect(last, `${rel}: no <PhotoShimmer /> right before ${tag.slice(0, 40)}…`).toBeGreaterThanOrEqual(0);
      expect(before.slice(last + '<PhotoShimmer />'.length), `${rel}: an element sits between the shimmer and the photo`).not.toMatch(/<[A-Za-z]/);
    }
    // The gallery's no-photo fallback has no shimmer.
    const gallery = stripComments(read('components/drive-exotiq/VehicleGallery.tsx'));
    const fallback = gallery.indexOf('bg-gradient-to-br from-surface2 to-panel');
    expect(gallery.slice(fallback - 60, fallback)).not.toContain('PhotoShimmer');
  });
});
