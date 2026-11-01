// Legibility guard rails (2026-11). The pass moved every text grey up one tier and floored the smallest text at 11px;
// these tests keep it that way. They read the real tokens and the real source, so a dimmer grey, a 10px size or a
// dim colour on words fails the build with the offender named.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { tone } from '@/components/browse/tokens';
import config from '../../tailwind.config';

const root = fileURLToPath(new URL('../../', import.meta.url));
const rgb = (hex: string): [number, number, number] => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as [number, number, number];
const lin = (v: number) => { const c = v / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
const lum = (hex: string) => { const [r, g, b] = rgb(hex); return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b); };
const ratio = (a: string, b: string) => { const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x); return (hi + 0.05) / (lo + 0.05); };
// APCA (0.0.98G constants), light text on a dark ground. A second opinion beside the WCAG ratio.
const apcaY = (hex: string) => { const [r, g, b] = rgb(hex).map((v) => (v / 255) ** 2.4); const y = 0.2126729 * r + 0.7151522 * g + 0.072175 * b; return y < 0.022 ? y + (0.022 - y) ** 1.414 : y; };
const apca = (text: string, ground: string) => { const t = apcaY(text), b = apcaY(ground); const s = (b ** 0.65 - t ** 0.62) * 1.14; return s > -0.1 ? 0 : Math.abs((s + 0.027) * 100); };

const SURFACES = ['ground', 'panel', 'surface', 'surface2', 'field'] as const;
const TEXT_TONES = ['ink', 'inkSoft', 'muted', 'faint'] as const;
const t = tone as Record<string, string>;

describe('legibility: contrast', () => {
  it('every text grey holds 7:1 and APCA Lc 62 on every surface it can sit on', () => {
    const weak: string[] = [];
    for (const name of TEXT_TONES) for (const surface of SURFACES) {
      const r = ratio(t[name], t[surface]), lc = apca(t[name], t[surface]);
      if (r < 7) weak.push(`${name} on ${surface}: ${r.toFixed(2)}:1`);
      if (lc < 62) weak.push(`${name} on ${surface}: Lc ${lc.toFixed(0)}`);
    }
    expect(weak).toEqual([]);
  });
  it('body text (muted) is a clear step above labels (faint), and below headings (ink)', () => {
    expect(lum(t.muted)).toBeGreaterThan(lum(t.faint));
    expect(lum(t.ink)).toBeGreaterThanOrEqual(lum(t.muted));
  });
  it('the guard sees a dim grey (planted)', () => {
    expect(ratio(t.dim, t.panel)).toBeLessThan(7);
    expect(apca(t.dim, t.panel)).toBeLessThan(62);
  });
});

describe('legibility: size floor', () => {
  const px = (size: string) => (size.endsWith('rem') ? parseFloat(size) * 16 : parseFloat(size));
  it('no step in the type scale is under 11px', () => {
    const fontSize = (config.theme?.extend?.fontSize ?? {}) as Record<string, [string, unknown]>;
    const under = Object.entries(fontSize).filter(([, [size]]) => px(size) < 11).map(([name, [size]]) => `${name}: ${size}`);
    expect(under).toEqual([]);
    expect(Object.keys(fontSize).length).toBeGreaterThan(8);
  });
  it('the two smallest steps are medium weight', () => {
    const fontSize = (config.theme?.extend?.fontSize ?? {}) as Record<string, [string, { fontWeight?: string }]>;
    expect([fontSize.micro[1].fontWeight, fontSize.label[1].fontWeight]).toEqual(['500', '500']);
  });

  const walk = (dir: string): string[] => readdirSync(join(root, dir)).flatMap((name) => {
    const rel = join(dir, name);
    return statSync(join(root, rel)).isDirectory() ? walk(rel) : [rel];
  });
  // The retired marketplace mockup (T-2) and the internal branch-preview page are not renter surfaces.
  const renterFiles = () => [...walk('app'), ...walk('components')].filter((f) => /\.tsx$/.test(f) && !f.endsWith('.test.tsx') && !f.startsWith('components/marketplace/') && f !== 'app/preview/page.tsx');

  it('no text-[Npx] literal under 11px on a renter surface', () => {
    const offenders = renterFiles().flatMap((file) => Array.from(readFileSync(join(root, file), 'utf8').matchAll(/text-\[(\d+(?:\.\d+)?)px\]/g)).filter((m) => Number(m[1]) < 11).map((m) => `${file}: ${m[0]}`));
    expect(offenders).toEqual([]);
  });
  it('no words wear dim or dim2 except in a disabled or taken state', () => {
    const plain = /(?<![\w:[\]-])text-dim2?(?![\w-])/g;
    const offenders = renterFiles().flatMap((file) => Array.from(readFileSync(join(root, file), 'utf8').matchAll(plain)).map(() => file));
    expect(offenders).toEqual([]);
    // Planted: the scan sees a plain dim text class and ignores a state-prefixed one.
    expect('class="text-dim"'.match(plain)).toHaveLength(1);
    expect('class="disabled:text-dim data-[taken]:text-dim"'.match(plain)).toBeNull();
  });
});
