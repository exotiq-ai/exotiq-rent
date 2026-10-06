// MP-16 AC12: warn and error stop sharing one amber. `tone.danger` (D9) must clear 4.5:1 on
// every surface it lands on and sit clearly apart from warn; the error sites in the spec's
// Warn vs danger map use it and the warn sites keep warn. Contrast is computed from `tone`.
import { describe, expect, it } from 'vitest';
import config from '../../tailwind.config';
import { tone } from '../../components/browse/tokens';
import { compileWith } from '../design/lib/scan.mjs';
import { between, contrast, hue, missing, mix, prepare, present, read, rgbDistance, sliceFunction } from './restraintScan';

const palette = tone as unknown as Record<string, string>;
const src = (rel: string): string => prepare(rel, read(rel));

const DRIVER = 'components/drive-exotiq/flow/DriverStep.tsx';
const REVIEW = 'components/drive-exotiq/flow/ReviewStep.tsx';
const SHARED = 'components/drive-exotiq/flow/shared.tsx';
const IDV = 'components/drive-exotiq/IdentityVerificationCard.tsx';
const PAYCARD = 'components/drive-exotiq/PaymentCard.tsx';
const CANCEL = 'components/drive-exotiq/CancelBookingCard.tsx';
const CONF = 'components/drive-exotiq/ConfirmationScreen.tsx';
const EMAIL = 'components/renters/EmailCaptureForm.tsx';
const SF = 'app/[operatorSlug]/page.tsx';
const BROWSE = 'app/browse/page.tsx';

/** A warn-family or danger-family utility (`text-warn`, `bg-danger/10`, `aria-[invalid=true]:border-warn/70` …). */
const WARN = /-warn(?![A-Za-z0-9])/g;
const DANGER = /-danger(?![A-Za-z0-9])/g;
const count = (text: string, re: RegExp): number => (text.match(re) ?? []).length;

/** One row of the Warn vs danger map: the text it governs, what it must carry, what it must not. */
type Row = { label: string; text: () => string; must: string[]; mustNot?: RegExp[] };

const ERROR_ROWS: Row[] = [
  { label: 'DriverStep invalid field, DOB error, under-age banner', text: () => src(DRIVER), must: ['aria-[invalid=true]:border-danger/70', "'mt-2 text-body-sm leading-5 text-danger'", 'border-danger/45 bg-danger/10'], mustNot: [WARN] },
  // MP-26: the request button and its error banner moved from the deleted PayStep into the merged Review & Request step.
  { label: 'ReviewStep payError', text: () => src(REVIEW), must: ['border-danger/45 bg-danger/10'], mustNot: [WARN] },
  { label: 'QuoteNotice failure banner, title, retry', text: () => sliceFunction(src(SHARED), 'QuoteNotice'), must: ['border-danger/45 bg-danger/10', 'text-danger', 'rounded-lg border border-danger/45'], mustNot: [WARN] },
  { label: 'EmailCaptureForm error line', text: () => src(EMAIL), must: ["'text-danger'"], mustNot: [WARN] },
  { label: 'IdentityVerificationCard requires_input (danger) and manual_review (warn)', text: () => src(IDV), must: ["status === 'requires_input'", 'border-danger/45 bg-danger/10', 'border-warn/45 bg-warn/10', 'text-danger', 'text-warn', 'rounded-lg border border-danger/45'] },
  { label: 'PaymentCard expired card', text: () => between(src(PAYCARD), "windowState === 'expired'", '</div>'), must: ['border-danger/45 bg-danger/10'], mustNot: [WARN] },
  { label: 'CancelBookingCard destructive confirm', text: () => src(CANCEL), must: ["'bg-danger text-goldInk'", 'border-warn/45 bg-warn/10'], mustNot: [/'bg-warn text-goldInk'/] },
];
const WARN_ROWS: Row[] = [
  { label: 'storefront unchecked-availability banner', text: () => src(SF), must: ['border-warn/45 bg-warn/10'], mustNot: [DANGER] },
  { label: '/browse unchecked-availability banner', text: () => src(BROWSE), must: ['border-warn/45 bg-warn/10'], mustNot: [DANGER] },
  { label: 'ReturnNotice payment not completed', text: () => sliceFunction(src(CONF), 'ReturnNotice'), must: ['border-warn/45 bg-warn/10', "'text-warn'"], mustNot: [DANGER] },
];

export function rowProblems(row: Row, text = row.text()): string[] {
  const problems = missing(row.label, text, ...row.must);
  for (const re of row.mustNot ?? []) if (count(text, re)) problems.push(`${row.label}: ${count(text, re)} ${re.source} use(s)`);
  return problems;
}

describe('MP-16 warn and error split (AC12)', () => {
  it('danger is accessible and error sites use it', async () => {
    const problems: string[] = [];
    const danger = palette.danger;
    expect(danger, 'tone.danger').toBe('#F87171');

    // Contrast on every surface it lands on, and on its own 10% tint over surface (5.53).
    for (const key of ['ground', 'panel', 'surface', 'surface2', 'field']) {
      const ratio = contrast(danger, palette[key]);
      if (ratio < 4.5) problems.push(`danger on ${key}: ${ratio.toFixed(2)}`);
    }
    const tint = contrast(danger, mix(danger, palette.surface, 0.1));
    if (tint < 4.5) problems.push(`danger on its 10% tint over surface: ${tint.toFixed(2)}`);
    if (contrast(palette.goldInk, danger) < 4.5) problems.push('goldInk on a danger fill is under 4.5:1');

    // Clearly apart from warn: hue and RGB distance.
    const hueGap = Math.abs(hue(danger) - hue(palette.warn));
    if (Math.min(hueGap, 360 - hueGap) < 20) problems.push(`danger hue within 20deg of warn (${hueGap.toFixed(1)})`);
    if (rgbDistance(danger, palette.warn) < 60) problems.push(`danger RGB distance from warn ${rgbDistance(danger, palette.warn).toFixed(1)}`);

    // In the theme (spread from tone), the CSS mirror, and compiled to real utilities.
    const colors = (config.theme?.extend?.colors ?? {}) as Record<string, unknown>;
    if (colors.danger !== danger) problems.push('tailwind theme has no danger colour');
    if (!new RegExp(`--tone-danger:\\s*${danger}\\s*;`, 'i').test(read('app/globals.css'))) problems.push('globals.css mirror has no --tone-danger');
    const { decls } = await compileWith(config, ['bg-danger/10', 'text-danger', 'border-danger/45', 'bg-danger']);
    for (const u of ['bg-danger/10', 'text-danger', 'border-danger/45', 'bg-danger']) if (decls(u).length === 0) problems.push(`${u} does not compile`);

    // The map: error sites danger, warn sites warn.
    for (const row of [...ERROR_ROWS, ...WARN_ROWS]) problems.push(...rowProblems(row));

    // PaymentCard: one notice state with a kind; cancelled and poll-timeout are warn, a thrown failure danger; urgent stays warn.
    const pc = src(PAYCARD);
    if (!/type Notice = \{ kind: 'warn' \| 'danger'; text: string \}/.test(pc)) problems.push('PaymentCard: no Notice kind type');
    if (!/useState<Notice \| undefined>/.test(pc)) problems.push('PaymentCard: notice state is not a Notice');
    const warnNotices = count(pc, /setNotice\(\{ kind: 'warn'/g);
    if (warnNotices !== 2) problems.push(`PaymentCard: ${warnNotices} warn notices, expected 2 (poll timeout, cancelled return)`);
    if (!/setNotice\(\{ kind: 'danger', text: err instanceof Error/.test(pc)) problems.push('PaymentCard: the thrown start failure is not a danger notice');
    if (!/notice\.kind === 'danger' \? 'border-danger\/45 bg-danger\/10' : 'border-warn\/45 bg-warn\/10'/.test(pc)) problems.push('PaymentCard: the pay banner does not pick its tone by kind');
    problems.push(...missing('PaymentCard urgent pill', pc, "'bg-warn/15 text-warn'"));
    problems.push(...present('PaymentCard', pc, '{notice}'));

    // Planted: an error site left on warn, and a warn site moved to danger, are both caught.
    expect(rowProblems(ERROR_ROWS[1], '<p className="rounded-xl border border-warn/45 bg-warn/10 p-3">{payError}</p>')).toHaveLength(2);
    expect(rowProblems(WARN_ROWS[0], '<p className="rounded-lg border border-danger/45 bg-danger/10">x</p>')).toHaveLength(2);

    expect(problems).toEqual([]);
  });
});
