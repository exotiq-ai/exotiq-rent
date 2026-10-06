// MP-23 (EmailCaptureForm field height). AC2: resolved through the real Tailwind config, the
// rendered e-mail field cannot collapse in the mobile column and the compact row keeps growing.
// AC1: the validator for the browser probe file (the probe is the verify lane's own run); its
// planted-bad cells always run, the real file is read only when MP23_EVIDENCE_DIR is set.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { EmailCaptureForm } from '@/components/renters/EmailCaptureForm';
import config from '../../tailwind.config';
import { compileWith } from '../design/lib/scan.mjs';
import { elements, parseHtml } from '../fees/fixtures';

afterEach(() => {
  vi.unstubAllEnvs();
});

// ---- AC2: the cascade guard ------------------------------------------------------------------

const px = (v: string) => (v.endsWith('rem') ? parseFloat(v) * 16 : v.endsWith('px') ? parseFloat(v) : 0);
const minWidthHolds = (params: string, width: number) => {
  const m = /^\(min-width:\s*(\d+)px\)$/.exec(params);
  return m ? width >= Number(m[1]) : false;
};

/** What wins on ONE element carrying `classString` at `width`: rules cascade in emitted order, media rules only when they match. */
async function flexOf(classString: string, width: number) {
  const classes = classString.split(/\s+/).filter(Boolean);
  const { rules } = await compileWith(config, classes);
  const won = { grow: 0, basis: 'auto', minHeightPx: 0, direction: 'row' as 'row' | 'column' };
  for (const r of rules as { selector: string; decls: string[]; rule: any }[]) {
    if (!classes.includes(r.selector.replace(/\\(.)/g, '$1').replace(/^\./, ''))) continue;
    let applies = true;
    for (let p = r.rule.parent; p && p.type !== 'root'; p = p.parent) if (p.type === 'atrule' && p.name === 'media') applies = applies && minWidthHolds(p.params, width);
    if (!applies) continue;
    for (const d of r.decls) {
      const prop = d.slice(0, d.indexOf(':'));
      const value = d.slice(d.indexOf(':') + 1);
      if (prop === 'flex') {
        // The shorthand sets grow and basis together: `1 1 0%` (flex-1), `1 1 auto`, `0 0 auto` (none).
        if (value === 'none') Object.assign(won, { grow: 0, basis: 'auto' });
        else if (value === 'auto') Object.assign(won, { grow: 1, basis: 'auto' });
        else { const [g, , b = '0%'] = value.split(/\s+/); Object.assign(won, { grow: Number(g), basis: b }); }
      } else if (prop === 'flex-grow') won.grow = Number(value);
      else if (prop === 'flex-basis') won.basis = value;
      else if (prop === 'min-height') won.minHeightPx = px(value);
      else if (prop === 'flex-direction') won.direction = value === 'column' ? 'column' : 'row';
    }
  }
  return won;
}

/** AC2's verdict for one variant at one width: why the field would collapse or stop filling, or nothing. */
async function problemsFor(label: string, wrapperClasses: string, inputClasses: string, width: number): Promise<string[]> {
  const wrapper = await flexOf(wrapperClasses, width);
  const input = await flexOf(inputClasses, width);
  const out: string[] = [];
  // A non-auto basis on the height axis beats h-10; only a basis of auto or a 2.5rem floor keeps 40px.
  if (wrapper.direction === 'column' && input.basis !== 'auto' && input.minHeightPx < 40) out.push(`${label} @${width}: column wrapper, flex-basis ${input.basis} and min-height ${input.minHeightPx}px, so the field collapses to its content`);
  if (wrapper.direction === 'row' && input.grow < 1) out.push(`${label} @${width}: row wrapper, flex-grow ${input.grow}, so the field stops filling the row`);
  return out;
}

const DEFAULT_WRAPPER = 'flex flex-col gap-2 sm:flex-row sm:items-stretch';
const COMPACT_WRAPPER = 'flex flex-nowrap items-stretch gap-2';
// The class literal as it stood at a73d09b, kept here so the guard can be shown to catch it.
const CURRENT = 'h-10 min-w-0 flex-1 rounded-lg border border-line bg-field px-3 text-body-lg text-ink outline-none transition placeholder:text-faint hover:border-line2 focus:border-gold/70 focus-visible:ring-2 focus-visible:ring-gold/60';

/** The e-mail input and its wrapper from the rendered markup (never from the source text). */
function rendered(compact: boolean) {
  vi.stubEnv('NEXT_PUBLIC_RENTER_CAPTURE', 'on');
  const html = renderToStaticMarkup(createElement(EmailCaptureForm, { source: 'footer', cta: 'Keep me posted', consentImplied: true, compact }));
  expect(html, 'the form rendered nothing: the capture flag did not take, every check below would be vacuous').not.toBe('');
  const input = elements(parseHtml(html)).find((e) => e.tag === 'input' && e.attrs.name === 'email');
  expect(input, 'e-mail input not found in the markup').toBeDefined();
  expect(input!.attrs.class, 'found the wrong input (want the e-mail field, not the honeypot)').toContain('text-body-lg');
  return { input: input!.attrs.class, wrapper: input!.parent!.attrs.class };
}

describe('MP-23 e-mail field height', () => {
  it('the non-compact field cannot collapse in the column axis and the compact row keeps growing', async () => {
    // Planted controls, always on: each bad shape must be reported, each good shape must pass.
    const planted: string[] = [];
    const expectBad = async (name: string, wrapper: string, input: string, width: number, label = 'default') => {
      if (!(await problemsFor(label, wrapper, input, width)).length) planted.push(`${name}: not reported at ${width}px`);
    };
    const expectGood = async (name: string, wrapper: string, input: string, width: number, label = 'default') => {
      const found = await problemsFor(label, wrapper, input, width);
      if (found.length) planted.push(`${name}: wrongly reported ${found.join('; ')}`);
    };
    await expectBad('current literal', DEFAULT_WRAPPER, CURRENT, 390);
    await expectBad('current literal + py-2', DEFAULT_WRAPPER, `${CURRENT} py-2`, 390);
    await expectBad('current literal + items-stretch on the column', `${DEFAULT_WRAPPER} items-stretch`, CURRENT, 390);
    await expectBad('min-height below 2.5rem', DEFAULT_WRAPPER, `${CURRENT} min-h-8`, 390);
    await expectBad('growth behind sm: loses the compact row grow', COMPACT_WRAPPER, CURRENT.replace('flex-1', 'sm:flex-1'), 390, 'compact');
    await expectBad('default variant without growth at 640', DEFAULT_WRAPPER, `${CURRENT.replace('flex-1', 'flex-none')} min-h-10`, 640);
    await expectBad('default variant without growth at 1280', DEFAULT_WRAPPER, `${CURRENT.replace('flex-1', 'flex-none')} min-h-10`, 1280);
    for (const w of [390, 639, 640, 1280]) await expectGood('min-h-10 fix', DEFAULT_WRAPPER, `${CURRENT} min-h-10`, w);
    await expectGood('min-h-10 fix, compact', COMPACT_WRAPPER, `${CURRENT} min-h-10`, 390, 'compact');
    await expectGood('flex-none sm:flex-1 for non-compact', DEFAULT_WRAPPER, CURRENT.replace('flex-1', 'flex-none sm:flex-1'), 390);
    expect(planted).toEqual([]);

    // The real render, both variants, through the same resolver.
    const problems: string[] = [];
    const def = rendered(false);
    for (const w of [390, 639, 640, 1280]) problems.push(...(await problemsFor('default', def.wrapper, def.input, w)));
    const compact = rendered(true);
    problems.push(...(await problemsFor('compact', compact.wrapper, compact.input, 390)));
    expect(problems).toEqual([]);
  });

  // ---- AC1: the probe-file validator -------------------------------------------------------

  it('footer probe shows a 40px field on every route and width', () => {
    expect(validateProbe(goodProbe())).toEqual([]);
    const planted: [string, (p: Probe) => void, string][] = [
      ['a 21px field at 390', (p) => { cell(p, 'after', '/browse', 390).input_height = 21; }, 'after /browse @390'],
      ['field and button heights differ by more than 0.5px', (p) => { cell(p, 'after', '/saved', 412).button_height = 41; }, 'after /saved @412'],
      ['a 14px computed font-size', (p) => { cell(p, 'after', '/privacy', 375).font_size = 14; }, 'after /privacy @375'],
      ['a missing route and width cell', (p) => { p.cells = p.cells.filter((c) => !(c.phase === 'after' && c.route === '/saved' && c.width === 639)); }, 'after /saved @639'],
      ['a column layout at 640', (p) => { cell(p, 'after', '/browse', 640).direction = 'column'; }, 'after /browse @640'],
      ['a row layout at 639', (p) => { cell(p, 'after', '/privacy', 639).direction = 'row'; }, 'after /privacy @639'],
      ['base cells that never show the defect', (p) => { for (const c of p.cells) if (c.phase === 'before') c.input_height = 40; }, 'cannot show the defect'],
      ['a branch cell at 1280 that differs from its base cell', (p) => { cell(p, 'after', '/privacy', 1280).input_width = 280; }, 'after /privacy @1280'],
      ['horizontal overflow at 320', (p) => { cell(p, 'after', '/browse', 320).scroll_width = 330; }, 'after /browse @320'],
    ];
    for (const [name, mutate, needle] of planted) {
      const bad = goodProbe();
      mutate(bad);
      expect(validateProbe(bad).some((line) => line.includes(needle)), `planted "${name}" was not reported (${needle})`).toBe(true);
    }
    const dir = process.env.MP23_EVIDENCE_DIR ?? '';
    if (dir) expect(validateProbe(JSON.parse(readFileSync(join(dir, 'AC1-footer-input-probe.json'), 'utf8')))).toEqual([]);
  });
});

type Cell = { phase: 'before' | 'after'; route: string; width: number; direction: 'column' | 'row'; input_height: number; button_height: number; input_width: number; font_size: number; scroll_width: number; inner_width: number };
type Probe = { base_sha: string; branch_sha: string; flags: string; cells: Cell[] };
const ROUTES = ['/browse', '/saved', '/privacy'];
const WIDTHS = [320, 375, 390, 412, 639, 640, 1280];

/** Every way the probe file can be wrong, labelled "<phase> <route> @<width>". Empty means AC1 holds. */
export function validateProbe(p: Probe): string[] {
  const problems: string[] = [];
  const sha = /^[0-9a-f]{7,40}$/;
  if (!sha.test(p.base_sha) || !sha.test(p.branch_sha) || p.base_sha === p.branch_sha) problems.push('base_sha and branch_sha must be two different commits');
  if (p.flags !== 'mock,browse=on,capture=on') problems.push(`flags: ${p.flags}`);
  const find = (phase: string, route: string, width: number) => p.cells.filter((c) => c.phase === phase && c.route === route && c.width === width);
  for (const phase of ['before', 'after'] as const) {
    for (const route of ROUTES) {
      for (const width of WIDTHS) {
        const key = `${phase} ${route} @${width}`;
        const found = find(phase, route, width);
        if (found.length !== 1) { problems.push(`${key}: ${found.length} cells, want exactly 1`); continue; }
        const c = found[0];
        const want = width < 640 ? 'column' : 'row';
        if (c.direction !== want) problems.push(`${key}: direction ${c.direction}, want ${want}`);
        if (c.inner_width !== width) problems.push(`${key}: inner_width ${c.inner_width}`);
        if (phase === 'before' && width < 640 && !(c.input_height < 25)) problems.push(`${key}: base field is ${c.input_height}px, so the probe cannot show the defect`);
        if (phase === 'after') {
          if (Math.abs(c.input_height - 40) > 0.5) problems.push(`${key}: field is ${c.input_height}px, want 40`);
          if (Math.abs(c.input_height - c.button_height) > 0.5) problems.push(`${key}: field ${c.input_height}px vs button ${c.button_height}px`);
          if (c.font_size !== 16) problems.push(`${key}: font-size ${c.font_size}px, want 16`);
          if (c.scroll_width > c.inner_width) problems.push(`${key}: scrollWidth ${c.scroll_width} exceeds innerWidth ${c.inner_width}`);
          const base = find('before', route, width)[0];
          if (width >= 640 && base && (base.direction !== c.direction || Math.abs(base.input_height - c.input_height) > 0.5 || Math.abs(base.input_width - c.input_width) > 1)) problems.push(`${key}: differs from its base cell`);
        }
      }
    }
  }
  return problems;
}

const cell = (p: Probe, phase: string, route: string, width: number) => p.cells.find((c) => c.phase === phase && c.route === route && c.width === width)!;

/** A planted good probe: 3 routes x 7 widths x 2 phases = 42 cells. */
function goodProbe(): Probe {
  const cells: Cell[] = [];
  for (const phase of ['before', 'after'] as const) {
    for (const route of ROUTES) {
      for (const width of WIDTHS) {
        const stacked = width < 640;
        cells.push({ phase, route, width, direction: stacked ? 'column' : 'row', input_height: phase === 'before' && stacked ? 21 : 40, button_height: 40, input_width: stacked ? width - 40 : 306, font_size: 16, scroll_width: width, inner_width: width });
      }
    }
  }
  return { base_sha: 'a73d09b', branch_sha: 'b0c1d2e', flags: 'mock,browse=on,capture=on', cells };
}
