// MP-18 AC3-AC5: nothing unfurls bare. Next 14.2's mergeMetadata REPLACES the parent's whole
// openGraph block (file-based image included) in any page that sets its own, and an explicit
// `images` key, even [], blocks the fallback. So every page-level openGraph must carry an image
// on purpose: a sibling opengraph-image file or the unfurl builders in seo.ts.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
// @ts-expect-error internal path, pinned to next 14.2.x (the resolver Next itself runs on page metadata)
import { resolveOpenGraph } from 'next/dist/lib/metadata/resolvers/resolve-opengraph';
import { stripComments } from '../../tests/design/lib/scan.mjs';
import { goldCount } from '../../tests/restraint/restraintScan';
import { tone } from '../../components/browse/tokens';
import { getMockPublicTeamStorefront, getMockPublicVehicleContext } from './mockService';
import * as seo from './seo';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const read = (rel: string) => readFileSync(join(ROOT, rel), 'utf8');

type Unfurl = { url: string; width?: number; height?: number; alt?: string };
const api = seo as unknown as {
  FLOOR_CARD?: Unfurl;
  unfurlImages?: (hero: string | null | undefined) => Unfurl[];
  storefrontOpenGraph?: (team: { name: string; city: string; state: string }, hero: string | null | undefined) => Record<string, unknown> & { images: Unfurl[] };
  vehicleOpenGraph?: (team: { city: string; state: string }, vehicle: { name: string; dailyRateCents: number; heroImage: string }) => Record<string, unknown> & { images: Unfurl[] };
};
const FLOOR = { url: '/opengraph-image', width: 1200, height: 630, alt: 'Drive Exotiq' };

// ---- AC3(c): the metadata-trap scanner --------------------------------------------------------

type PageFile = { path: string; source: string; siblings: string[] };
const BUILDERS = ['unfurlImages(', 'storefrontOpenGraph(', 'vehicleOpenGraph('];
const CARD_FILE = /^opengraph-image\.(tsx?|jsx?|png|jpe?g|gif)$/;

/** Pages/layouts that define their own openGraph with neither a sibling card file nor a builder call: they would unfurl bare. */
export function findBareOpenGraph(files: PageFile[]): string[] {
  return files
    .filter((f) => /\bopenGraph\b/.test(stripComments(f.source)))
    .filter((f) => !f.siblings.some((s) => CARD_FILE.test(s)) && !BUILDERS.some((b) => stripComments(f.source).includes(b)))
    .map((f) => f.path);
}

/** Every app/**\/page.tsx and layout.tsx with its directory listing. */
function appPages(): PageFile[] {
  const out: PageFile[] = [];
  const walk = (dir: string) => {
    const entries = readdirSync(join(ROOT, dir), { withFileTypes: true });
    const names = entries.map((e) => e.name);
    for (const e of entries) {
      const rel = `${dir}/${e.name}`;
      if (e.isDirectory()) walk(rel);
      else if (/^(page|layout)\.tsx$/.test(e.name)) out.push({ path: rel, source: read(rel), siblings: names });
    }
  };
  walk('app');
  return out;
}

describe('MP-18 link previews (AC3)', () => {
  it('scanner flags the bare shapes and passes the good ones', () => {
    const bare = { path: 'a/page.tsx', source: 'export const metadata = { openGraph: { title: "x" } };', siblings: ['page.tsx'] };
    const empty = { path: 'b/page.tsx', source: 'return { openGraph: { title, images: [] } };', siblings: ['page.tsx'] };
    const sibling = { path: 'c/page.tsx', source: 'return { openGraph: { title } };', siblings: ['page.tsx', 'opengraph-image.tsx'] };
    const builder = { path: 'd/page.tsx', source: 'return { openGraph: vehicleOpenGraph(team, vehicle) };', siblings: ['page.tsx'] };
    const commented = { path: 'e/page.tsx', source: '// openGraph: unfurlImages(hero)\nreturn { openGraph: { title } };', siblings: ['page.tsx'] };
    const none = { path: 'f/page.tsx', source: 'return { title: "x" };', siblings: ['page.tsx'] };
    expect(findBareOpenGraph([bare, empty, sibling, builder, commented, none])).toEqual(['a/page.tsx', 'b/page.tsx', 'e/page.tsx']);
  });

  it('every page that defines openGraph has an image source', () => {
    const pages = appPages();
    expect(pages.length).toBeGreaterThan(10);
    expect(findBareOpenGraph(pages)).toEqual([]);
  });

  it('builders always yield an image', () => {
    const src = stripComments(read('domain/booking/seo.ts'));
    for (const name of ['storefrontOpenGraph', 'vehicleOpenGraph']) {
      const at = src.indexOf(`export function ${name}(`);
      expect(at, `${name} is not exported`).toBeGreaterThanOrEqual(0);
      const body = src.slice(at, src.indexOf('\n}', at));
      expect(body, `${name} does not build its images with unfurlImages(`).toContain('unfurlImages(');
    }
    for (const hero of ['', undefined, 'http://x.co/a.png', 'https://x.co/a.png']) {
      expect(api.storefrontOpenGraph?.({ name: 'A', city: 'B', state: 'C' }, hero).images.length).toBeGreaterThanOrEqual(1);
      expect(api.vehicleOpenGraph?.({ city: 'B', state: 'C' }, { name: 'V', dailyRateCents: 100, heroImage: hero ?? '' }).images.length).toBeGreaterThanOrEqual(1);
    }
  });

  it('floor card is a 1200 by 630 png under 200 KB', async () => {
    const rel = 'app/opengraph-image.tsx';
    expect(existsSync(join(ROOT, rel)), `${rel} is missing`).toBe(true);
    const mod = (await import('../../app/opengraph-image')) as { alt: string; size: { width: number; height: number }; contentType: string; default: () => Promise<Response> };
    expect(mod.size).toEqual({ width: 1200, height: 630 });
    expect(mod.contentType).toBe('image/png');
    expect(mod.alt).toBe('Drive Exotiq');
    expect(api.FLOOR_CARD).toEqual(FLOOR);
    expect({ url: '/opengraph-image', width: mod.size.width, height: mod.size.height, alt: mod.alt }).toEqual(api.FLOOR_CARD);

    const buf = Buffer.from(await (await mod.default()).arrayBuffer());
    expect(buf.subarray(0, 8)).toEqual(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
    expect([buf.readUInt32BE(16), buf.readUInt32BE(20)]).toEqual([1200, 630]);
    expect(buf.length).toBeLessThanOrEqual(200 * 1024);

    // Brand only: no photograph, no price, no runtime data (so it prerenders), no gold (errata #2: tone.line2 frame).
    const src = stripComments(read(rel));
    expect(src).toContain('Drive Exotiq');
    expect(src).toContain('Curated exotic & luxury rentals');
    expect(src).not.toMatch(/heroImage|getPublic|photos|\$\d|\/day|dailyRate|formatMoney|Money/);
    expect(src).not.toMatch(/from ['"](@\/|\.\.\/)domain\//);
    expect(src).not.toMatch(/\bparams\b|headers\(|cookies\(/);
    expect(goldCount(src)).toBe(0);
    expect(src).toContain('tone.line2');
  });

  it('unfurlImages falls back to the floor card for empty and non https urls', () => {
    const fallbacks: (string | null | undefined)[] = ['', '   ', undefined, null, 'http://x.co/a.png', 'javascript:alert(1)', 'exotiq.rent/a.png', '//cdn.example/a.png', '/\\evil.example/a.png', 'https://', 'https://a b.png', 'data:image/png;base64,AAAA', 'images/a.png'];
    for (const hero of fallbacks) {
      const got = api.unfurlImages?.(hero);
      expect(got, JSON.stringify(hero)).toEqual([FLOOR]);
      expect(got?.length).toBeGreaterThanOrEqual(1);
    }
    for (const hero of ['https://x.supabase.co/storage/v1/object/public/vehicles/a.png', '/images/vehicles/mclaren-750s.png']) {
      expect(api.unfurlImages?.(hero), hero).toEqual([{ url: hero }]);
    }
    // The fallback is a fresh object each call: a caller mutating one result cannot poison the next.
    const a = api.unfurlImages?.('');
    if (a) a[0].alt = 'changed';
    expect(api.unfurlImages?.('')).toEqual([FLOOR]);
  });
});

// ---- AC4: the storefront ----------------------------------------------------------------------

describe('MP-18 storefront link preview (AC4)', () => {
  it('storefront openGraph names the operator and uses the first car', async () => {
    const storefront = await getMockPublicTeamStorefront('desert-exotic-rentals');
    expect(storefront).not.toBeNull();
    const { team, vehicles } = storefront!;
    expect(vehicles[0].heroImage).not.toBe('');
    const og = api.storefrontOpenGraph?.(team, vehicles[0].heroImage);
    expect(og).toBeDefined();
    const rootTitle = /title: "(Drive Exotiq \| [^"]+)"/.exec(read('app/layout.tsx'))?.[1];
    expect(rootTitle).toBe('Drive Exotiq | Curated Exotic & Luxury Rentals');
    expect(String(og!.title)).toContain(team.name);
    expect(og!.title).not.toBe(rootTitle);
    expect(String(og!.description)).toContain(`${team.city}, ${team.state}`);
    expect(og!.siteName).toBe('Drive Exotiq');
    expect(og!.type).toBe('website');
    expect(og!.images).toEqual(api.unfurlImages?.(vehicles[0].heroImage));
    expect(og!.images[0].url).toBe(vehicles[0].heroImage);

    // The route wires it from the first car, the same car the page shows first.
    const page = stripComments(read('app/[operatorSlug]/page.tsx'));
    const meta = page.slice(page.indexOf('export async function generateMetadata'), page.indexOf('\n}', page.indexOf('export async function generateMetadata')));
    expect(meta).toMatch(/openGraph: storefrontOpenGraph\(storefront\.team, storefront\.vehicles\[0\]\?\.heroImage\)/);
    expect(page).toContain('const heroVehicle = vehicles[0];');
  });

  it('storefront openGraph falls back to the floor card without a car', () => {
    const team = { name: 'Acme Exotics', city: 'Denver', state: 'CO' };
    for (const hero of [undefined, '', null]) {
      const og = api.storefrontOpenGraph?.(team, hero);
      expect(og?.images, JSON.stringify(hero)).toEqual([FLOOR]);
      expect(String(og?.title)).toContain('Acme Exotics');
    }
  });
});

// ---- AC5: the vehicle page and the share page --------------------------------------------------

describe('MP-18 vehicle link preview (AC5)', () => {
  it('vehicle openGraph carries site name, type and the hero', async () => {
    const ctx = await getMockPublicVehicleContext('desert-exotic-rentals', 'mclaren-750s-spider');
    expect(ctx).not.toBeNull();
    const { team, vehicle } = ctx!;
    const og = api.vehicleOpenGraph?.(team, vehicle);
    expect(og).toBeDefined();
    // Today's strings, unchanged.
    expect(og!.title).toBe(`${vehicle.name} | Drive Exotiq`);
    const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(vehicle.dailyRateCents / 100);
    expect(og!.description).toBe(`From ${money}/day. ${team.city}, ${team.state}.`);
    expect(og!.siteName).toBe('Drive Exotiq');
    expect(og!.type).toBe('website');
    expect(og!.images).toEqual([{ url: vehicle.heroImage }]);

    // The route uses the builder, not a hand-written block.
    const page = stripComments(read('app/[operatorSlug]/[vehicleSlug]/page.tsx'));
    expect(page).toContain('openGraph: vehicleOpenGraph(team, vehicle),');
    expect(page).not.toMatch(/images:\s*vehicle\.heroImage/);
  });

  it('relative mock hero resolves to an absolute url through metadataBase', async () => {
    const ctx = await getMockPublicVehicleContext('desert-exotic-rentals', 'mclaren-750s-spider');
    const og = resolveOpenGraph(api.vehicleOpenGraph?.(ctx!.team, ctx!.vehicle), new URL('https://book.example'), { pathname: '/', isStandaloneMode: false }, null);
    expect(String(og.images[0].url)).toBe(`https://book.example${ctx!.vehicle.heroImage}`);
    const floor = resolveOpenGraph(api.vehicleOpenGraph?.(ctx!.team, { ...ctx!.vehicle, heroImage: '' }), new URL('https://book.example'), { pathname: '/', isStandaloneMode: false }, null);
    expect(String(floor.images[0].url)).toBe('https://book.example/opengraph-image');
    expect([floor.images[0].width, floor.images[0].height, floor.images[0].alt]).toEqual([1200, 630, 'Drive Exotiq']);
  });

  it('vehicle openGraph falls back to the floor card without a hero', () => {
    const og = api.vehicleOpenGraph?.({ city: 'Scottsdale', state: 'AZ' }, { name: '2024 Test Car', dailyRateCents: 99_900, heroImage: '' });
    expect(og?.images).toEqual([FLOOR]);
    expect(og?.images.length).toBe(1);
  });

  it('share route keeps its own card file', () => {
    const dir = 'app/share/[operatorSlug]/[vehicleSlug]';
    expect(existsSync(join(ROOT, dir, 'opengraph-image.tsx'))).toBe(true);
    const page = stripComments(read(`${dir}/page.tsx`));
    const at = page.indexOf('openGraph: {');
    expect(at).toBeGreaterThanOrEqual(0);
    let depth = 0;
    let end = at + 'openGraph: '.length;
    for (; end < page.length; end++) {
      if (page[end] === '{') depth++;
      else if (page[end] === '}' && --depth === 0) break;
    }
    expect(page.slice(at, end + 1)).not.toMatch(/\bimages\b/);
    // The share card is untouched: still gold-framed and reading RESERVED (D6 of MP-16 pins its 4 gold refs).
    const card = read(`${dir}/opengraph-image.tsx`);
    expect(card).toContain('RESERVED');
    expect(goldCount(stripComments(card))).toBe(4);
    // A tone sanity check so the floor card's neutral frame is a real token.
    expect(tone.line2).toMatch(/^#[0-9A-F]{6}$/i);
  });
});
