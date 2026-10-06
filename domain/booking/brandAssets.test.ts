// MP-18 AC1-AC2: the icon set, the colour scheme and the manifest. Every icon is DERIVED from the
// design-system emblem (never redrawn): the white winged D centred on a full-bleed #06070a tile.
// The validators below decode the files independently of scripts/brand-icons.mjs (their own PNG
// and ICO readers), are fixture-tested on bad inputs, and then run on the real files.
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { crc32, deflateSync, inflateSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { stripComments } from '../../tests/design/lib/scan.mjs';
import { tone } from '../../components/browse/tokens';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const file = (rel: string) => readFileSync(join(ROOT, rel));
const read = (rel: string) => file(rel).toString('utf8');

/** sha256 of the design-system emblem-white.svg (Brand & Logos/.../drive-exotiq-design-system/assets/), pinned so the test never reads outside the repo. */
const EMBLEM_SHA = '1f23e0ddaa6a700e5713826e7297ea49b41c1f49c930a58a2cc3d9599099b14b';
const EMBLEM_COPY = 'public/images/logos/drive-exotiq-emblem-white.svg';
const GROUND = [0x06, 0x07, 0x0a];

// ---- an independent PNG reader --------------------------------------------------------------

type Png = { w: number; h: number; colorType: number; chunks: string[]; px: Buffer; bpp: number };
function decodePng(buf: Buffer): Png {
  if (!buf.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) throw new Error('not a PNG');
  const types: string[] = [];
  const idat: Buffer[] = [];
  let ihdr: Buffer | undefined;
  for (let o = 8; o < buf.length; ) {
    const len = buf.readUInt32BE(o);
    const type = buf.toString('latin1', o + 4, o + 8);
    const data = buf.subarray(o + 8, o + 8 + len);
    types.push(type);
    if (type === 'IHDR') ihdr = data;
    if (type === 'IDAT') idat.push(data);
    o += 12 + len;
  }
  if (!ihdr) throw new Error('no IHDR');
  const w = ihdr.readUInt32BE(0);
  const h = ihdr.readUInt32BE(4);
  const colorType = ihdr[9];
  if (ihdr[8] !== 8 || ![2, 6].includes(colorType) || ihdr[12] !== 0) throw new Error(`unsupported PNG (depth ${ihdr[8]}, colour type ${colorType}, interlace ${ihdr[12]})`);
  const bpp = colorType === 6 ? 4 : 3;
  const stride = w * bpp;
  const raw = inflateSync(Buffer.concat(idat));
  const px = Buffer.alloc(h * stride);
  for (let y = 0; y < h; y++) {
    const filter = raw[y * (stride + 1)];
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? px[y * stride + x - bpp] : 0;
      const b = y ? px[(y - 1) * stride + x] : 0;
      const c = x >= bpp && y ? px[(y - 1) * stride + x - bpp] : 0;
      let v = raw[y * (stride + 1) + 1 + x];
      if (filter === 1) v += a;
      else if (filter === 2) v += b;
      else if (filter === 3) v += (a + b) >> 1;
      else if (filter === 4) {
        const p = a + b - c;
        const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
        v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      }
      px[y * stride + x] = v & 255;
    }
  }
  return { w, h, colorType, chunks: types, px, bpp };
}

/** A minimal PNG writer for the fixtures (filter 0 on every row). */
function encodePng(w: number, h: number, colorType: 2 | 6, pixel: (x: number, y: number) => number[]): Buffer {
  const bpp = colorType === 6 ? 4 : 3;
  const raw = Buffer.alloc(h * (w * bpp + 1));
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) pixel(x, y).forEach((v, i) => { raw[y * (w * bpp + 1) + 1 + x * bpp + i] = v; });
  const chunk = (type: string, data: Buffer) => {
    const t = Buffer.from(type, 'latin1');
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([t, data])) >>> 0);
    return Buffer.concat([len, t, data, crc]);
  };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = colorType;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

/** A fixture tile: ground everywhere, a white block `frac` of the width, centred. */
const tile = (px: number, frac: number, colorType: 2 | 6 = 2) => {
  const ew = Math.round(px * frac), eh = Math.round(ew * 0.586), x0 = Math.floor((px - ew) / 2), y0 = Math.floor((px - eh) / 2);
  return encodePng(px, px, colorType, (x, y) => [...(x >= x0 && x < x0 + ew && y >= y0 && y < y0 + eh ? [255, 255, 255] : GROUND), ...(colorType === 6 ? [255] : [])]);
};

// ---- the validators -------------------------------------------------------------------------

/** Bounding box of the pixels that are clearly not the ground. */
function emblemBox(p: Png) {
  let x0 = Infinity, x1 = -1, y0 = Infinity, y1 = -1;
  for (let y = 0; y < p.h; y++) for (let x = 0; x < p.w; x++) {
    const i = (y * p.w + x) * p.bpp;
    if (Math.abs(p.px[i] - GROUND[0]) + Math.abs(p.px[i + 1] - GROUND[1]) + Math.abs(p.px[i + 2] - GROUND[2]) > 60) {
      x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
    }
  }
  return { x0, x1, y0, y1, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}

/** AC1 tile rules: the size, the full-bleed ground, the emblem's share of the width, centred. */
export function tileProblems(png: Buffer, px: number, opts: { opaque?: boolean } = {}): string[] {
  const problems: string[] = [];
  let p: Png;
  try { p = decodePng(png); } catch (e) { return [String(e)]; }
  if (p.w !== px || p.h !== px) problems.push(`size ${p.w}x${p.h}, want ${px}x${px}`);
  if (opts.opaque && (p.colorType !== 2 || p.chunks.includes('tRNS'))) problems.push(`not opaque (colour type ${p.colorType}${p.chunks.includes('tRNS') ? ', tRNS' : ''})`);
  for (const [x, y] of [[0, 0], [p.w - 1, 0], [0, p.h - 1], [p.w - 1, p.h - 1]]) {
    const i = (y * p.w + x) * p.bpp;
    const rgb = [p.px[i], p.px[i + 1], p.px[i + 2]];
    const alpha = p.bpp === 4 ? p.px[i + 3] : 255;
    if (rgb.some((v, k) => v !== GROUND[k]) || alpha !== 255) problems.push(`corner ${x},${y} is ${rgb.join(',')}/${alpha}, not the opaque ground`);
  }
  const box = emblemBox(p);
  if (box.x1 < 0) return [...problems, 'no emblem'];
  const min = px <= 48 ? 0.7 : 0.56;
  if (box.w / px < min) problems.push(`emblem width ${(box.w / px).toFixed(3)} of the tile, want >= ${min}`);
  const cx = (box.x0 + box.x1 + 1) / 2, cy = (box.y0 + box.y1 + 1) / 2;
  if (Math.abs(cx - px / 2) > 1.5 || Math.abs(cy - px / 2) > 1.5) problems.push(`emblem centre ${cx},${cy}, want ${px / 2},${px / 2}`);
  // White, not tinted: the brightest pixel's weakest channel is near 255.
  let white = 0;
  for (let i = 0; i < p.w * p.h; i++) white = Math.max(white, Math.min(p.px[i * p.bpp], p.px[i * p.bpp + 1], p.px[i * p.bpp + 2]));
  if (white < 230) problems.push(`the emblem is not white (brightest pixel ${white})`);
  return problems;
}

/** AC1 ICO rules: the ICO header, three images of 16, 32 and 48 px, each a PNG of its directory size that passes the tile rules. */
export function icoProblems(buf: Buffer): string[] {
  if (buf.length < 6 || buf.readUInt16LE(0) !== 0 || buf.readUInt16LE(2) !== 1) return ['not an ICO (header)'];
  const count = buf.readUInt16LE(4);
  const problems: string[] = [];
  const sizes: number[] = [];
  for (let n = 0; n < count; n++) {
    const e = 6 + 16 * n;
    const size = buf[e] || 256;
    const len = buf.readUInt32LE(e + 8), off = buf.readUInt32LE(e + 12);
    sizes.push(size);
    if (off + len > buf.length) { problems.push(`entry ${size}: payload past the end`); continue; }
    problems.push(...tileProblems(buf.subarray(off, off + len), size).map((p) => `entry ${size}: ${p}`));
  }
  if (JSON.stringify([...sizes].sort((a, b) => a - b)) !== JSON.stringify([16, 32, 48])) problems.push(`sizes ${sizes.join(',')}, want 16,32,48`);
  return problems;
}

const pathData = (svg: string) => /\sd="([^"]+)"/.exec(svg)?.[1];

/** AC1 icon.svg rules: the emblem's path data verbatim, a full-bleed ground rect, the emblem centred at >= 70% width. */
export function iconSvgProblems(svg: string, emblemSvg: string): string[] {
  const problems: string[] = [];
  const d = pathData(svg), want = pathData(emblemSvg);
  if (!want) return ['the emblem copy has no path'];
  if (d !== want) problems.push('the path data differs from the emblem (redrawn)');
  if ((svg.match(/<path\b/g) ?? []).length !== 1) problems.push('icon.svg must hold exactly the one emblem path');
  const vb = /viewBox="0 0 (\d+) (\d+)"/.exec(svg);
  const side = vb ? Number(vb[1]) : NaN;
  if (!vb || vb[1] !== vb[2]) problems.push('icon.svg is not square');
  const rect = /<rect width="(\d+)" height="(\d+)" fill="([^"]+)"\/>/.exec(svg);
  if (!rect || Number(rect[1]) !== side || Number(rect[2]) !== side || rect[3].toLowerCase() !== tone.ground.toLowerCase()) problems.push('no full-bleed ground rect');
  const g = /<g transform="translate\(([\d.]+) ([\d.]+)\) scale\(([\d.]+)\)">/.exec(svg);
  const ev = /viewBox="0 0 (\d+) (\d+)"/.exec(emblemSvg);
  if (!g || !ev) return [...problems, 'no translate/scale group'];
  const [tx, ty, s] = g.slice(1).map(Number);
  const [ew, eh] = ev.slice(1).map(Number);
  if ((ew * s) / side < 0.7) problems.push(`emblem width ${((ew * s) / side).toFixed(3)} of the tile, want >= 0.7`);
  if (Math.abs(tx + (ew * s) / 2 - side / 2) > 1 || Math.abs(ty + (eh * s) / 2 - side / 2) > 1) problems.push('emblem is not centred');
  if (!/fill="#ffffff"/i.test(svg.slice(svg.indexOf('<path')))) problems.push('the emblem is not white');
  return problems;
}

// ---- AC2 validators -------------------------------------------------------------------------

const block = (src: string, from: string, to?: string) => {
  const a = src.indexOf(from);
  if (a < 0) return '';
  const b = to ? src.indexOf(to, a + from.length) : -1;
  return src.slice(a, b < 0 ? src.indexOf('\n};', a) + 3 : b);
};

/** AC2 layout rules on the comment-stripped app/layout.tsx. */
export function layoutProblems(source: string): string[] {
  const src = stripComments(source);
  const viewport = block(src, 'export const viewport', 'export default');
  const metadata = block(src, 'export const metadata', 'export const viewport');
  const problems: string[] = [];
  if (!viewport) return ['no viewport export'];
  if (!/\bcolorScheme:\s*"dark",/.test(viewport)) problems.push('viewport has no colorScheme: "dark"');
  if (!/themeColor:\s*isMarketplace\s*\?\s*"#0B0B0F"\s*:\s*tone\.ground,/.test(viewport)) problems.push('viewport themeColor changed');
  for (const [k, re] of [['viewportFit', /viewportFit:\s*"cover",/], ['width', /width:\s*"device-width",/], ['initialScale', /initialScale:\s*1,/]] as const) if (!re.test(viewport)) problems.push(`viewport lost ${k}`);
  if (/\b(themeColor|colorScheme)\b/.test(metadata)) problems.push('metadata holds themeColor or colorScheme (Unsupported metadata)');
  return problems;
}

type Manifest = { name?: string; short_name?: string; display?: string; theme_color?: string; background_color?: string; icons?: { src: string; sizes?: string; type?: string }[] };
/** AC2 manifest rules; `exists` resolves an icon src to a file under public/. */
export function manifestProblems(m: Manifest, exists: (src: string) => boolean): string[] {
  const problems: string[] = [];
  if (m.name !== 'Drive Exotiq' || m.short_name !== 'Drive Exotiq') problems.push('name/short_name are not "Drive Exotiq"');
  if (m.display !== 'browser') problems.push(`display ${m.display}, want browser`);
  if (m.theme_color !== tone.ground || m.background_color !== tone.ground) problems.push('theme/background colour is not the ground');
  for (const [src, sizes] of [['/icon-192.png', '192x192'], ['/icon-512.png', '512x512']]) {
    const icon = m.icons?.find((i) => i.src === src);
    if (!icon || icon.sizes !== sizes || icon.type !== 'image/png') problems.push(`icon ${src} ${sizes} missing`);
  }
  for (const icon of m.icons ?? []) if (!exists(icon.src)) problems.push(`icon ${icon.src} has no file (404)`);
  return problems;
}

// ---- the tests ------------------------------------------------------------------------------

describe('MP-18 icon set (AC1)', () => {
  it('validators reject bad inputs', () => {
    // Good fixtures pass, so the rejections below are the rules, not a broken reader.
    const ico = (sizes: number[]) => {
      const pngs = sizes.map((s) => tile(s, 0.76));
      const head = Buffer.alloc(6); head.writeUInt16LE(1, 2); head.writeUInt16LE(sizes.length, 4);
      let off = 6 + 16 * sizes.length;
      const dir = pngs.map((png, n) => { const e = Buffer.alloc(16); e[0] = e[1] = sizes[n]; e.writeUInt16LE(1, 4); e.writeUInt16LE(32, 6); e.writeUInt32LE(png.length, 8); e.writeUInt32LE(off, 12); off += png.length; return e; });
      return Buffer.concat([head, ...dir, ...pngs]);
    };
    expect(icoProblems(ico([16, 32, 48]))).toEqual([]);
    expect(icoProblems(ico([16, 32]))).toContain('sizes 16,32, want 16,32,48');
    expect(icoProblems(ico([16]))).toContain('sizes 16, want 16,32,48');
    expect(tileProblems(tile(180, 0.62), 180, { opaque: true })).toEqual([]);
    expect(tileProblems(tile(180, 0.62, 6), 180, { opaque: true })).toContain('not opaque (colour type 6)');
    expect(tileProblems(tile(181, 0.62), 180)).toContain('size 181x181, want 180x180');
    expect(tileProblems(tile(32, 0.5), 32).join()).toMatch(/emblem width 0\.500/);
    const emblem = read(EMBLEM_COPY);
    const good = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 1200"><rect width="1200" height="1200" fill="${tone.ground}"/><g transform="translate(144 332.86) scale(0.76)"><path d="${pathData(emblem)}" fill="#ffffff"/></g></svg>`;
    expect(iconSvgProblems(good, emblem)).toEqual([]);
    const d = pathData(emblem)!;
    const redrawn = good.replace(d, d.replace(/\d(?=\D*$)/, (c) => String((Number(c) + 1) % 10)));
    expect(iconSvgProblems(redrawn, emblem)).toContain('the path data differs from the emblem (redrawn)');
  });

  it('favicon.ico holds 16, 32 and 48 pixel images', () => {
    expect(existsSync(join(ROOT, 'app/favicon.ico')), 'app/favicon.ico is missing').toBe(true);
    expect(icoProblems(file('app/favicon.ico'))).toEqual([]);
  });

  it('apple icon is 180 by 180 and opaque and the manifest icons are 192 and 512', () => {
    for (const rel of ['app/apple-icon.png', 'public/icon-192.png', 'public/icon-512.png']) expect(existsSync(join(ROOT, rel)), `${rel} is missing`).toBe(true);
    expect(tileProblems(file('app/apple-icon.png'), 180, { opaque: true })).toEqual([]);
    expect(tileProblems(file('public/icon-192.png'), 192)).toEqual([]);
    expect(tileProblems(file('public/icon-512.png'), 512)).toEqual([]);
  });

  it('icon.svg carries the emblem path unchanged', () => {
    expect(createHash('sha256').update(file(EMBLEM_COPY)).digest('hex'), 'the emblem copy is not the design-system emblem-white.svg byte for byte').toBe(EMBLEM_SHA);
    expect(existsSync(join(ROOT, 'app/icon.svg')), 'app/icon.svg is missing').toBe(true);
    expect(iconSvgProblems(read('app/icon.svg'), read(EMBLEM_COPY))).toEqual([]);
  });
});

describe('MP-18 colour scheme and manifest (AC2)', () => {
  it('layout viewport adds color scheme and keeps theme color', () => {
    const fixture = 'export const metadata: Metadata = { title: "x" };\nexport const viewport: Viewport = {\n  viewportFit: "cover",\n  width: "device-width",\n  initialScale: 1,\n  themeColor: isMarketplace ? "#0B0B0F" : tone.ground,\n  colorScheme: "dark",\n};\nexport default function L() {}';
    expect(layoutProblems(fixture)).toEqual([]);
    expect(layoutProblems(fixture.replace('  colorScheme: "dark",\n', ''))).toEqual(['viewport has no colorScheme: "dark"']);
    expect(layoutProblems(fixture.replace('tone.ground', '"#000000"'))).toEqual(['viewport themeColor changed']);
    expect(layoutProblems(read('app/layout.tsx'))).toEqual([]);
  });

  it('metadata object holds no theme color or color scheme', () => {
    const fixture = 'export const metadata: Metadata = { title: "x", themeColor: "#06070a" };\nexport const viewport: Viewport = {\n  viewportFit: "cover",\n  width: "device-width",\n  initialScale: 1,\n  themeColor: isMarketplace ? "#0B0B0F" : tone.ground,\n  colorScheme: "dark",\n};\nexport default function L() {}';
    expect(layoutProblems(fixture)).toEqual(['metadata holds themeColor or colorScheme (Unsupported metadata)']);
    const src = stripComments(read('app/layout.tsx'));
    expect(block(src, 'export const metadata', 'export const viewport')).not.toMatch(/\b(themeColor|colorScheme)\b/);
  });

  it('web manifest names the brand and points at both icons', async () => {
    expect(existsSync(join(ROOT, 'app/manifest.ts')), 'app/manifest.ts is missing').toBe(true);
    const exists = (src: string) => existsSync(join(ROOT, 'public', src));
    const good: Manifest = { name: 'Drive Exotiq', short_name: 'Drive Exotiq', display: 'browser', theme_color: tone.ground, background_color: tone.ground, icons: [{ src: '/icon-192.png', sizes: '192x192', type: 'image/png' }, { src: '/icon-512.png', sizes: '512x512', type: 'image/png' }] };
    expect(manifestProblems(good, () => true)).toEqual([]);
    expect(manifestProblems({ ...good, display: 'standalone' }, () => true)).toEqual(['display standalone, want browser']);
    expect(manifestProblems(good, (src) => src !== '/icon-512.png')).toEqual(['icon /icon-512.png has no file (404)']);
    const manifest = ((await import('../../app/manifest')) as { default: () => Manifest }).default();
    expect(manifestProblems(manifest, exists)).toEqual([]);
    expect(stripComments(read('app/manifest.ts'))).not.toMatch(/#[0-9a-f]{3,8}\b/i);
  });
});
