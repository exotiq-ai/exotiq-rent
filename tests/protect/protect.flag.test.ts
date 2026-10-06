// MP-30 AC1, AC10, AC16, AC19, AC20: the flag is one literal reader, every Protect literal left in
// renter source is allowlisted behind its guard, the re-enable requirements are written down at the
// flag and every gate, and the change stays inside its named files. No React here. Red on the base
// by design (the module does not exist yet); AC19 and AC20's diff parts run only with MP30_BASE_REF.
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { stripComments } from '../design/lib/scan.mjs';
import { sliceFunction } from '../restraint/restraintScan';

const protect = async () => { try { return await import('@/domain/booking/protect'); } catch { return null; } };

const REPO = fileURLToPath(new URL('../../', import.meta.url));
const read = (rel: string) => readFileSync(join(REPO, rel), 'utf8');
const readOr = (rel: string) => (existsSync(join(REPO, rel)) ? read(rel) : '');
const ENV = 'NEXT_PUBLIC_PROTECT_ENABLED';
const BASE = process.env.MP30_BASE_REF ?? '';
const git = (...a: string[]) => execFileSync('git', a, { cwd: REPO, encoding: 'utf8' }).trim();
/** A file at the base, byte for byte (git() trims, which would drop the final newline). */
const atBase = (rel: string) => execFileSync('git', ['show', `${BASE}:${rel}`], { cwd: REPO, encoding: 'utf8' });
const lines = (s: string) => s.split('\n').map((l) => l.trim()).filter(Boolean);
function walk(dir: string, out: string[] = []): string[] {
  if (!existsSync(join(REPO, dir))) return out; // lib/ does not exist in this repo
  for (const e of readdirSync(join(REPO, dir), { withFileTypes: true })) {
    const rel = `${dir}/${e.name}`;
    if (e.isDirectory()) { if (e.name !== 'node_modules' && e.name !== '.next') walk(rel, out); }
    else if (/\.(tsx?|mjs|cjs|js)$/.test(e.name) && !/\.test\./.test(e.name)) out.push(rel);
  }
  return out;
}
const filesOf = (dirs: string[]) => Object.fromEntries(dirs.flatMap((d) => walk(d)).sort().map((r) => [r, read(r)]));

afterEach(() => { vi.unstubAllEnvs(); });

// ---- AC1: one literal reader ------------------------------------------------------------------------

/** AC1 over a { path: source } map of app/components/domain/lib (tests excluded). */
function readerProblems(files: Record<string, string>): string[] {
  const p: string[] = [];
  const named = Object.keys(files).filter((f) => files[f].includes(ENV));
  if (JSON.stringify(named) !== JSON.stringify(['domain/booking/protect.ts'])) p.push(`files naming ${ENV}: ${JSON.stringify(named)}`);
  for (const [f, t] of Object.entries(files)) {
    const code = stripComments(t);
    if (/process\.env\[/.test(code)) p.push(`${f}: computed process.env[...] read`);
    if (/\bprocess\.env\.PROTECT_ENABLED\b|\[\s*['"`]PROTECT_ENABLED['"`]\s*\]|\benv\.PROTECT_ENABLED\b/.test(code)) p.push(`${f}: bare PROTECT_ENABLED read`);
    if (/^(?:export\s+)?(?:const|let|var)\s+\w+\s*=[^\n]*\bprotectEnabled\(\)/m.test(code)) p.push(`${f}: caches protectEnabled() at module level`);
  }
  const mod = files['domain/booking/protect.ts'];
  if (mod) {
    const code = stripComments(mod);
    const fn = sliceFunction(code, 'protectEnabled');
    if (!fn.includes(`return process.env.${ENV} === 'true';`)) p.push('protectEnabled is not the literal per-call read');
    if (code.replace(fn, '').includes(ENV)) p.push(`${ENV} is read outside protectEnabled (a module-level cache?)`);
    const imports = Array.from(code.matchAll(/^import .*$/gm), (m) => m[0]);
    if (JSON.stringify(imports) !== JSON.stringify(["import type { ProtectionTier } from './types';"])) p.push(`protect.ts imports ${JSON.stringify(imports)}`);
  }
  return p;
}

/** A known-good flag module, for the planted controls. */
const GOOD_MODULE = [
  "import type { ProtectionTier } from './types';",
  '',
  '// TODO(PROTECT_ENABLED): planted.',
  'export function protectEnabled(): boolean {',
  `  return process.env.${ENV} === 'true';`,
  '}',
  '',
  'export function defaultProtection(): ProtectionTier {',
  "  return protectEnabled() ? 'premium' : 'decline';",
  '}',
  '',
].join('\n');

// ---- AC10: the literal census -------------------------------------------------------------------------

const SCAN_SKIP = ['components/marketplace', 'components/analytics', 'app/preview', 'app/terms', 'app/privacy'];
const scanned = (p: string) => /^(app|components)\//.test(p) && /\.tsx?$/.test(p) && !/\.test\./.test(p) && !SCAN_SKIP.some((s) => p.startsWith(`${s}/`));
const norm = (s: string) => s.replace(/\s+/g, ' ').trim();
function literalHits(file: string, text: string): { file: string; text: string }[] {
  const sf = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const hits: { file: string; text: string }[] = [];
  const visit = (n: ts.Node): void => {
    if (ts.isImportDeclaration(n) || ts.isExportDeclaration(n)) return;
    if (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n) || ts.isTemplateHead(n) || ts.isTemplateMiddle(n) || ts.isTemplateTail(n) || ts.isJsxText(n)) {
      if (/protect|coverage/i.test(n.text)) hits.push({ file, text: norm(n.text) });
    }
    ts.forEachChild(n, visit);
  };
  visit(sf);
  return hits;
}
const SF = 'app/[operatorSlug]/page.tsx';
const CANCEL = 'components/drive-exotiq/CancelBookingCard.tsx';
const CONF = 'components/drive-exotiq/ConfirmationScreen.tsx';
const PAY = 'components/drive-exotiq/PaymentCard.tsx';
const FOLD = 'components/drive-exotiq/feeGroups.ts';
const REVIEW = 'components/drive-exotiq/flow/ReviewStep.tsx';
/** Every Protect literal left in renter source, with the guard that keeps it off the page while the flag is off. */
const ALLOW: { file: string; text: string; guard: string }[] = [
  { file: SF, text: 'A concierge-approved fleet with mobile-first booking, verified drivers, transparent rental charges, and optional Exotiq Protect shown separately.', guard: 'protectEnabled()' },
  { file: SF, text: 'Exotiq Protect is shown separately.', guard: 'protectEnabled()' },
  { file: CANCEL, text: 'The 72-hour window has passed: the rental, Trip Fees, and protection are non-refundable. Cancelling releases the dates without a refund.', guard: 'cancelNotice protection = protectEnabled() || protectionCharged' },
  { file: CONF, text: 'Trip fees and protection are itemized at payment, once the operator approves.', guard: 'mentionProtect(live.protectionTotalCents)' },
  { file: PAY, text: 'protection,', guard: 'mentionProtect(protectionTotalCents)' },
  { file: FOLD, text: 'protect', guard: 'the protectionTotalCents > 0 data rule (FeeLine key type)' },
  { file: FOLD, text: 'protect', guard: 'the protectionTotalCents > 0 data rule' },
  { file: FOLD, text: 'Exotiq Protect', guard: 'the protectionTotalCents > 0 data rule' },
  { file: REVIEW, text: 'and protection', guard: 'protectEnabled()' },
  { file: REVIEW, text: 'Cancellation & coverage', guard: 'protectEnabled()' },
  { file: REVIEW, text: 'Exotiq Protect covers damage to the vehicle during your rental period. Full coverage terms are provided before pickup.', guard: 'protectEnabled() && protectionOn' },
  { file: REVIEW, text: 'Exotiq Protect', guard: 'ProtectSwitch (rendered only behind protectEnabled())' },
  { file: REVIEW, text: 'Premium coverage ·', guard: 'ProtectSwitch' },
  { file: REVIEW, text: 'Exotiq Protect', guard: 'ProtectSwitch' },
];
const PER_FILE: Record<string, number> = { [SF]: 2, [CANCEL]: 1, [CONF]: 1, [PAY]: 1, [FOLD]: 3, [REVIEW]: 6 };
/** The guard each allowlisted literal hides behind, pinned in comment-stripped source. */
const GUARD_PINS: [string, string][] = [
  [REVIEW, 'between={protectEnabled() && onProtect && <ProtectSwitch'],
  [REVIEW, "for Trip fees{protectEnabled() && ' and protection'}."],
  [REVIEW, "{protectEnabled() ? 'Cancellation & coverage' : 'Cancellation policy'}"],
  [REVIEW, '{protectEnabled() && protectionOn && ('],
  [PAY, "{mentionProtect(protectionTotalCents) && 'protection, '}"],
  [CONF, "{mentionProtect(live.protectionTotalCents) ? 'Trip fees and protection are itemized at payment, once the operator approves.' : 'Trip fees are itemized at payment, once the operator approves.'}"],
  [CONF, 'protectionCharged={(live.protectionTotalCents ?? 0) > 0}'],
  [CANCEL, 'cancelNotice({ free, paid, protection: protectEnabled() || protectionCharged })'],
  [SF, "{team.about ?? (protectEnabled() ? 'A concierge-approved fleet"],
  [SF, "...(protectEnabled() ? ['Exotiq Protect is shown separately.'] : [])"],
  [FOLD, 'if (input.protectionTotalCents > 0) {'],
];
const hitKey = (h: { file: string; text: string }) => `${h.file} :: ${h.text}`;
/** The census over a { path: source } map: hits, per-file counts, and the multiset and per-file problems. */
function census(files: Record<string, string>) {
  const hits = Object.entries(files).filter(([p]) => scanned(p)).flatMap(([p, t]) => literalHits(p, t));
  const perFile: Record<string, number> = {};
  for (const h of hits) perFile[h.file] = (perFile[h.file] ?? 0) + 1;
  const problems: string[] = [];
  const want = ALLOW.map(hitKey);
  const left = [...want];
  for (const k of hits.map(hitKey)) { const i = left.indexOf(k); if (i >= 0) left.splice(i, 1); else problems.push(`unlisted Protect literal: ${k}`); }
  for (const k of left) problems.push(`allowlisted literal not found: ${k}`);
  for (const f of Array.from(new Set([...Object.keys(PER_FILE), ...Object.keys(perFile)]))) if ((perFile[f] ?? 0) !== (PER_FILE[f] ?? 0)) problems.push(`per-file count ${f}: ${perFile[f] ?? 0}, pinned ${PER_FILE[f] ?? 0}`);
  return { hits, perFile, problems };
}
const table = (perFile: Record<string, number>) => Object.entries(perFile).sort().map(([f, n]) => `  ${String(n).padStart(2)}  ${f}`).join('\n');

// ---- AC16: the re-enable requirements --------------------------------------------------------------

const POINTER = 'TODO(PROTECT_ENABLED): see domain/booking/protect.ts';
const GATES = ['components/drive-exotiq/BookingFlow.tsx', 'domain/booking/mockData.ts', 'domain/booking/quote.ts', 'domain/booking/supabaseService.ts', REVIEW, PAY, CONF, CANCEL, SF];
const REQUIREMENTS = [
  'toggle defaults OFF, never pre-selected;',
  "label 'Exotiq Protect · optional damage waiver' (never 'coverage' or 'insurance' — today's 'Premium coverage' label violates this);",
  'price, maximum protected amount, renter participation amount and a Protect-terms link must show before selection.',
];
function requirementProblems(src: Record<string, string>): string[] {
  const p: string[] = [];
  const mod = src['domain/booking/protect.ts'] ?? '';
  const above = mod.slice(0, Math.max(0, mod.indexOf('export function protectEnabled'))).trimEnd().split('\n');
  const block: string[] = [];
  for (let i = above.length - 1; i >= 0 && above[i].startsWith('//'); i--) block.unshift(above[i]);
  const text = block.map((l) => l.replace(/^\/\/ ?/, '')).join('\n');
  if (!block[0]?.startsWith('// TODO(PROTECT_ENABLED):')) p.push('protect.ts: the comment directly above protectEnabled does not begin TODO(PROTECT_ENABLED):');
  if (!norm(text).includes("must not be set to 'true' on any deploy until Protect meets the re-enable requirements")) p.push('protect.ts: the deploy rule is missing');
  for (const r of REQUIREMENTS) if (!text.includes(r)) p.push(`protect.ts: missing verbatim "${r}"`);
  for (const g of GATES) {
    const raw = src[g] ?? '';
    if (!raw.includes(POINTER)) p.push(`${g}: no "${POINTER}" pointer`);
    if (stripComments(raw).includes('TODO(PROTECT_ENABLED)')) p.push(`${g}: the pointer is not a comment`);
  }
  const rv = src[REVIEW] ?? '';
  const doc = rv.slice(0, rv.indexOf('function ProtectSwitch('));
  if (!doc.slice(doc.lastIndexOf('/**')).includes(POINTER)) p.push('ReviewStep: the ProtectSwitch doc comment has no pointer');
  return p;
}
const requirementSources = () => Object.fromEntries(['domain/booking/protect.ts', ...GATES].map((f) => [f, readOr(f)]));

// ---- AC19 / AC20: scope and build config ------------------------------------------------------------

const SCOPE = new Set([
  'domain/booking/protect.ts', 'domain/booking/mockData.ts', 'domain/booking/quote.ts', 'domain/booking/supabaseService.ts',
  'components/drive-exotiq/BookingFlow.tsx', REVIEW, PAY, CONF, CANCEL, SF,
  'scripts/fee-matrix.mjs', 'scripts/restraint-matrix.mjs', 'tests/fees/fees.surfaces.test.tsx',
]);
const scopeProblems = (changed: string[]) => changed.filter((p) => !SCOPE.has(p) && !p.startsWith('tests/protect/')).map((p) => `out of scope: ${p}`);
const LOCKSTEP_LINE = "  vi.stubEnv('NEXT_PUBLIC_PROTECT_ENABLED', 'true');";
/** The fees.surfaces diff (git diff -U0) is exactly one added line, the flag stub. */
function lockstepProblems(diffU0: string): string[] {
  const body = diffU0.split('\n').filter((l) => /^[+-]/.test(l) && !/^(\+\+\+|---) /.test(l));
  return JSON.stringify(body) === JSON.stringify([`+${LOCKSTEP_LINE}`]) ? [] : [`fees.surfaces lockstep diff: ${JSON.stringify(body)}`];
}
const BUILD_CONFIG = ['package.json', 'package-lock.json', 'vitest.config.mts', 'next.config.js', 'tailwind.config.ts', 'app/globals.css', 'netlify.toml', 'tsconfig.json'];
const configProblems = (changed: string[]) => changed.filter((p) => BUILD_CONFIG.includes(p)).map((p) => `build config changed: ${p}`);

describe('MP-30 the flag', () => {
  it('the flag is one literal reader and is off unless exactly true', async () => {
    const problems: string[] = [];
    // (a) one reader under app/components/domain/lib, literal and per call; (e) gate files never name it.
    problems.push(...readerProblems(filesOf(['app', 'components', 'domain', 'lib'])));
    // (b) the two QA scripts are the only other readers (the canary must not read it).
    const scripts = Object.keys(filesOf(['scripts'])).filter((f) => read(f).includes(ENV));
    if (JSON.stringify(scripts) !== JSON.stringify(['scripts/fee-matrix.mjs', 'scripts/restraint-matrix.mjs'])) problems.push(`scripts naming ${ENV}: ${JSON.stringify(scripts)}`);
    // (c) off unless exactly 'true'; (d) read on every call.
    const mod = await protect();
    if (!mod) problems.push('domain/booking/protect.ts is missing');
    else {
      for (const v of [undefined, '', 'false', 'TRUE', 'True', '1', 'on', ' true', 'true ']) {
        vi.stubEnv(ENV, v);
        if (mod.protectEnabled() !== false) problems.push(`${JSON.stringify(v)} reads as on`);
      }
      vi.stubEnv(ENV, 'true');
      const first = mod.protectEnabled();
      vi.stubEnv(ENV, 'false');
      const second = mod.protectEnabled();
      if (first !== true || second !== false) problems.push(`per call: 'true' then 'false' read ${first} then ${second}`);
    }

    // Planted: each way of breaking the rule is reported, and the good map is clean.
    const good = { 'domain/booking/protect.ts': GOOD_MODULE };
    expect(readerProblems(good), 'the good map').toEqual([]);
    expect(readerProblems({ ...good, 'components/x.tsx': `export const a = process.env.${ENV};` }).join('\n')).toContain(`files naming ${ENV}`);
    expect(readerProblems({ ...good, 'components/x.tsx': 'export const read = (name: string) => process.env[name];' }).join('\n')).toContain('computed process.env[...] read');
    expect(readerProblems({ ...good, 'components/x.tsx': 'export const on = process.env.PROTECT_ENABLED;' }).join('\n')).toContain('bare PROTECT_ENABLED read');
    expect(readerProblems({ 'domain/booking/protect.ts': `import type { ProtectionTier } from './types';\nconst ON = process.env.${ENV} === 'true';\nexport function protectEnabled() { return ON; }\n` }).join('\n')).toContain('read outside protectEnabled');
    expect(readerProblems({ ...good, 'components/x.tsx': "import { protectEnabled } from '@/domain/booking/protect';\nconst ON = protectEnabled();\n" }).join('\n')).toContain('caches protectEnabled() at module level');

    expect(problems).toEqual([]);
  });

  it('every remaining Protect literal in source is allowlisted and flag-guarded', () => {
    const files = filesOf(['app', 'components']);
    const now = census(files);
    console.info(`AC10 census now: ${now.hits.length} hits in ${Object.keys(now.perFile).length} files\n${table(now.perFile)}`);
    const problems = [...now.problems];
    for (const [f, pin] of GUARD_PINS) if (!stripComments(read(f)).includes(pin)) problems.push(`${f}: guard pin missing: ${pin}`);
    const inSwitch = literalHits(REVIEW, sliceFunction(read(REVIEW), 'ProtectSwitch')).map((h) => h.text);
    if (JSON.stringify(inSwitch) !== JSON.stringify(['Exotiq Protect', 'Premium coverage ·', 'Exotiq Protect'])) problems.push(`ProtectSwitch literals ${JSON.stringify(inSwitch)}`);

    if (BASE) {
      const paths = lines(git('ls-tree', '-r', '--name-only', BASE, '--', 'app', 'components')).filter(scanned);
      const base = census(Object.fromEntries(paths.map((p) => [p, git('show', `${BASE}:${p}`)])));
      console.info(`AC10 census at base ${BASE.slice(0, 7)}: ${base.hits.length} hits in ${Object.keys(base.perFile).length} files\n${table(base.perFile)}`);
      if (base.hits.length !== 14 || Object.keys(base.perFile).length !== 6) problems.push(`base census ${base.hits.length} hits in ${Object.keys(base.perFile).length} files, expected 14 in 6`);
    }

    // Planted: split JSX text and a template tail count; an import, an identifier and a comment do not.
    const planted = [
      "import { protectEnabled } from '@/domain/booking/protect';",
      '// protect',
      'const protectionTotalCents = 0;',
      'const t = `x ${protectionTotalCents} coverage`;',
      'export const C = () => (',
      '  <p>',
      '    Exotiq',
      '    Protect is',
      '    shown',
      '  </p>',
      ');',
    ].join('\n');
    expect(literalHits('components/planted.tsx', planted).map((h) => h.text)).toEqual(['coverage', 'Exotiq Protect is shown']);
    // An unlisted literal anywhere fails the multiset; a removed allowlisted one fails the per-file pin.
    expect(census({ ...files, 'components/drive-exotiq/Planted.tsx': "export const s = 'more protection';" }).problems.join('\n')).toContain('unlisted Protect literal');
    expect(census({ ...files, [SF]: files[SF].split('Exotiq Protect is shown separately.').join('Shown separately.') }).problems.join('\n')).toContain(`per-file count ${SF}`);

    expect(problems).toEqual([]);
  });

  it('the re-enable requirements are recorded verbatim at the flag and every gate', () => {
    const src = requirementSources();
    const problems = requirementProblems(src);

    // Planted: a comma for the middle dot, a gate without its pointer, the ProtectSwitch doc without one.
    const mod = src['domain/booking/protect.ts'];
    expect(requirementProblems({ ...src, 'domain/booking/protect.ts': mod.replace('·', ',') }).join('\n')).toContain("missing verbatim \"label 'Exotiq Protect · optional damage waiver'");
    expect(requirementProblems({ ...src, [PAY]: src[PAY].split(POINTER).join('TODO(MP-31)') }).join('\n')).toContain(`${PAY}: no "${POINTER}" pointer`);
    const rv = src[REVIEW];
    const at = rv.indexOf('function ProtectSwitch(');
    const d = rv.lastIndexOf('/**', at);
    expect(requirementProblems({ ...src, [REVIEW]: rv.slice(0, d) + rv.slice(d, at).split(POINTER).join('TODO(MP-31)') + rv.slice(at) })).toContain('ReviewStep: the ProtectSwitch doc comment has no pointer');

    expect(problems).toEqual([]);
  });
});

describe('MP-30 scope', () => {
  it('MP-30 touches only its named files', () => {
    // Always on: the checkers catch what they must.
    expect(scopeProblems(['domain/booking/totals.ts'])).not.toEqual([]);
    expect(scopeProblems(['tests/protect/x.test.ts', 'domain/booking/protect.ts'])).toEqual([]);
    expect(lockstepProblems(`--- a/tests/fees/fees.surfaces.test.tsx\n+++ b/tests/fees/fees.surfaces.test.tsx\n@@ -102,0 +103,2 @@\n+${LOCKSTEP_LINE}\n+  expect(1).toBe(1);`)).not.toEqual([]);
    expect(lockstepProblems(`--- a/tests/fees/fees.surfaces.test.tsx\n+++ b/tests/fees/fees.surfaces.test.tsx\n@@ -102,0 +103 @@\n+${LOCKSTEP_LINE}`)).toEqual([]);
    if (!BASE) return; // CI: the diff part needs MP30_BASE_REF, as MP-26's guards do

    const problems: string[] = [];
    const changed = Array.from(new Set([...lines(git('diff', '--name-only', BASE)), ...lines(git('ls-files', '--others', '--exclude-standard'))]));
    problems.push(...scopeProblems(changed));
    problems.push(...lockstepProblems(git('diff', '-U0', BASE, '--', 'tests/fees/fees.surfaces.test.tsx')));
    if (sliceFunction(stripComments(atBase(REVIEW)), 'ProtectSwitch') !== sliceFunction(stripComments(read(REVIEW)), 'ProtectSwitch')) problems.push('ProtectSwitch body differs from the base (comments aside)');
    expect(problems).toEqual([]);
  });

  it('MP-30 adds no dependency and changes no build config', () => {
    expect(configProblems(['domain/booking/protect.ts', 'package.json'])).toEqual(['build config changed: package.json']);
    if (!BASE) return;
    expect(lines(git('diff', '--name-only', BASE, '--', ...BUILD_CONFIG))).toEqual([]);
  });
});
