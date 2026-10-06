// MP-26 golden helpers (AC5, AC8, AC19). Not a test file. The slicers take server-rendered markup
// and return byte-exact substrings (element offsets from parseHtml), and the cuts replace only the
// places this ticket changes with fixed placeholders, so a golden recorded from the base compares
// equal to the same render after the change.
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { type El, classes, elements, hasClass, norm, outer, parseHtml, textOf } from './fixtures';

export const REPO = fileURLToPath(new URL('../../', import.meta.url));
export const GOLDEN_DIR = fileURLToPath(new URL('./golden/', import.meta.url));
export const BASE_JSON = join(GOLDEN_DIR, 'base.json');

/** AC19's four, AC5's two, P6's two (AC8 "other callers keep six"). */
export const GOLDEN_FILES = [
  'dates-step.html',
  'driver-step.html',
  'sticky-footer.html',
  'panel-header-row.html',
  'protect-switch-on.html',
  'protect-switch-off.html',
  'stepbar-default-6.html',
  'stepbar-numbered.html',
] as const;
export type GoldenFile = (typeof GOLDEN_FILES)[number];

export const sha256 = (text: string | Buffer) => createHash('sha256').update(text).digest('hex');
export const readGolden = (name: GoldenFile): string => readFileSync(join(GOLDEN_DIR, name), 'utf8');
export const goldenExists = (name: GoldenFile) => existsSync(join(GOLDEN_DIR, name));
export const git = (...args: string[]): string => execFileSync('git', args, { cwd: REPO, encoding: 'utf8' }).trim();

/** Replace each element's inner markup with a placeholder (ranges applied right to left). */
export function cutInner(html: string, cuts: [El | undefined, string][]): string {
  const found = cuts.map(([el, label]) => {
    if (!el) throw new Error(`cut target missing: ${label}`);
    return [el, label] as const;
  });
  let out = html;
  for (const [el, label] of [...found].sort((a, b) => b[0].innerStart - a[0].innerStart)) out = out.slice(0, el.innerStart) + label + out.slice(el.innerEnd);
  return out;
}

/** StepHeader's eyebrow: the first element child of the `mb-4` header block. */
export const eyebrowEl = (root: El): El | undefined => {
  const header = elements(root).find((e) => e.tag === 'div' && classes(e).join(' ') === 'mb-4');
  return header?.children.find((c): c is El => typeof c !== 'string');
};
/** The identity sentence under "ID check comes after booking". */
export const identitySentenceEl = (root: El): El | undefined => {
  const heading = elements(root).find((e) => e.tag === 'div' && norm(textOf(e)) === 'ID check comes after booking');
  const box = heading?.parent;
  return box?.children.find((c): c is El => typeof c !== 'string' && c.tag === 'p');
};

/** DatesStep with its eyebrow cut. */
export const cutDates = (html: string) => cutInner(html, [[eyebrowEl(parseHtml(html)), '«eyebrow»']]);
/** DriverStep with its eyebrow and identity sentence cut. */
export function cutDriver(html: string): string {
  const root = parseHtml(html);
  return cutInner(html, [[eyebrowEl(root), '«eyebrow»'], [identitySentenceEl(root), '«identity-sentence»']]);
}

const STRIP = 'flex justify-center gap-1 px-4 pb-2 pt-0';
export const stripEl = (root: El): El | undefined => elements(root).find((e) => e.tag === 'div' && classes(e).join(' ') === STRIP);
export const numberedStripEl = (root: El): El | undefined => elements(root).find((e) => e.tag === 'div' && hasClass(e, 'flex', 'items-center', 'gap-3', 'px-6', 'pb-4', 'pt-1'));

/** The panel frame's header row through the step strip, the strip replaced by a placeholder. */
export function panelHeaderRow(html: string): string {
  const root = parseHtml(html);
  const row = elements(root).find((e) => e.tag === 'div' && hasClass(e, 'grid', 'flex-shrink-0', 'grid-cols-[40px_1fr_40px]'));
  const strip = stripEl(root);
  if (!row || !strip) throw new Error('panel header row or step strip not found');
  return `${html.slice(row.start, strip.start)}«step-strip»`;
}
export function barsStrip(html: string): string {
  const el = stripEl(parseHtml(html));
  if (!el) throw new Error('bars step strip not found');
  return outer(html, el);
}
export function numberedStrip(html: string): string {
  const el = numberedStripEl(parseHtml(html));
  if (!el) throw new Error('numbered step strip not found');
  return outer(html, el);
}

/** The Protect switch block: the hairline section that holds the role="switch" button, title, subtitle and all. */
export function switchBlockEl(root: El): El | undefined {
  const button = elements(root).find((e) => e.tag === 'button' && e.attrs.role === 'switch' && e.attrs['aria-label'] === 'Exotiq Protect');
  for (let n = button?.parent ?? null; n; n = n.parent) if (n.tag === 'div' && classes(n).join(' ') === 'mt-4 border-t border-line pt-4') return n;
  return undefined;
}
export function switchBlock(html: string): string {
  const el = switchBlockEl(parseHtml(html));
  if (!el) throw new Error('Protect switch block not found');
  return outer(html, el);
}
