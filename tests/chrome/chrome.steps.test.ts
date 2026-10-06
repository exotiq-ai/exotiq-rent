// MP-17 AC9: the flow progress and the step eyebrows share one list, FLOW_STEPS (flow/steps.ts,
// shipped by MP-26). The progress renders its labels from it, the current item sits where
// stepEyebrow(n) says, and no second array of step labels exists anywhere under app/ or
// components/ (the legacy components/marketplace/ excluded).
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createElement, type ComponentType } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/components/analytics/PostHogInit', () => ({
  useCookieConsent: () => ({ ready: false, visibility: 'hidden', choice: { analytics: false, marketing: false }, gpc: false, choose() {}, activeDetails: null, setActiveDetails() {} }),
}));
vi.mock('@/components/drive-exotiq/fonts', () => ({ driveFontClassName: 'font-vars' }));

import { BookingChrome } from '@/components/drive-exotiq/BookingChrome';
import { FLOW_STEPS, stepEyebrow } from '@/components/drive-exotiq/flow/steps';
import { stripComments } from '../design/lib/scan.mjs';
import { byAttr, elements, norm, parseHtml, textOf } from '../fees/fixtures';

const REPO = fileURLToPath(new URL('../../', import.meta.url));
const read = (rel: string) => readFileSync(join(REPO, rel), 'utf8');
const CHROME = 'components/drive-exotiq/BookingChrome.tsx';
const Chrome = BookingChrome as unknown as ComponentType<Record<string, unknown>>;

function sources(dir: string): string[] {
  const out: string[] = [];
  const walk = (d: string) => {
    for (const e of readdirSync(join(REPO, d), { withFileTypes: true })) {
      const rel = `${d}/${e.name}`;
      if (e.isDirectory()) { if (rel !== 'components/marketplace') walk(rel); }
      else if (/\.(tsx?|mts|m?js)$/.test(e.name) && !/\.test\./.test(e.name)) out.push(rel);
    }
  };
  walk(dir);
  return out.sort();
}

/** A literal array of step labels: one that opens with two of the flow's labels in a row. */
const LABEL_ARRAY = /\[\s*['"`](?:Vehicle|Dates)['"`]\s*,\s*['"`](?:Dates|Driver)['"`]/;
export const labelArrays = (text: string): boolean => LABEL_ARRAY.test(text);

/** The progress items of a render: label text and whether each is current. */
function items(html: string): { label: string; current: boolean }[] {
  const nav = byAttr(parseHtml(html), 'data-chrome', 'progress')[0];
  return nav ? elements(nav).filter((e) => e.tag === 'li').map((li) => ({ label: norm(textOf(li)), current: li.attrs['aria-current'] === 'step' })) : [];
}

describe('MP-17 steps (AC9)', () => {
  it('progress labels and step eyebrows come from FLOW_STEPS', () => {
    const problems: string[] = [];
    const labels = FLOW_STEPS.map((s) => s.label);
    for (let n = 1; n <= FLOW_STEPS.length; n++) {
      const got = items(renderToStaticMarkup(createElement(Chrome, { step: n }, createElement('p', null, 'x'))));
      if (JSON.stringify(got.map((i) => i.label)) !== JSON.stringify(labels)) problems.push(`step=${n}: progress labels ${JSON.stringify(got.map((i) => i.label))}, FLOW_STEPS ${JSON.stringify(labels)}`);
      const at = got.findIndex((i) => i.current);
      if (at !== n - 1 || got.filter((i) => i.current).length !== 1) problems.push(`step=${n}: current item at ${at + 1}`);
      else if (got[at].label !== FLOW_STEPS[n - 1].label) problems.push(`step=${n}: current "${got[at].label}", FLOW_STEPS[${n - 1}] "${FLOW_STEPS[n - 1].label}"`);
      if (stepEyebrow(n) !== `Step ${n} of 3`) problems.push(`stepEyebrow(${n}) = "${stepEyebrow(n)}"`);
      if (stepEyebrow(n) !== `Step ${at + 1} of ${got.length}`) problems.push(`step=${n}: eyebrow "${stepEyebrow(n)}" disagrees with the progress (${at + 1} of ${got.length})`);
    }

    // One list: no literal array of step labels anywhere in the renter tree, and the chrome maps FLOW_STEPS.
    for (const rel of [...sources('app'), ...sources('components')]) if (labelArrays(stripComments(read(rel)))) problems.push(`${rel}: a literal array of step labels`);
    const chrome = stripComments(read(CHROME));
    if (!/import\s*\{[^}]*\bFLOW_STEPS\b[^}]*\}\s*from\s*['"]\.\/flow\/steps['"]/.test(chrome)) problems.push('BookingChrome does not import FLOW_STEPS from ./flow/steps');
    if (!/FLOW_STEPS\.map\(/.test(chrome)) problems.push('BookingChrome does not map FLOW_STEPS');
    for (const word of ['Dates', 'Driver', 'Review']) if (new RegExp(`['"\`]${word}`).test(chrome)) problems.push(`BookingChrome holds a "${word}" literal`);

    // Planted: a second label list and a label literal in the chrome are caught.
    expect(labelArrays("const LABELS = ['Dates', 'Driver', 'Review & Request'];")).toBe(true);
    expect(labelArrays("const labels = ['Vehicle', 'Dates', 'Driver', 'Review', 'Pay', 'Done'];")).toBe(true);
    expect(labelArrays("export const FLOW_STEPS = [{ key: 'dates', label: 'Dates' }, { key: 'driver', label: 'Driver' }];")).toBe(false);
    expect(problems).toEqual([]);
  });
});
