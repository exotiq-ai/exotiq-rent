// MP-37 AC2, AC6, AC7 (built output). These read a real `.next` directory and run only when told
// where it is; they never build and never touch the network.
//   MAINTENANCE_BUILD_DIR=<path to .next>    the build to read
//   MAINTENANCE_BUILD_MODE=on|off            how that build was made
//   MAINTENANCE_BUILD_LOG=<path to the log>  the saved `npm run build` output of that build
//   MAINTENANCE_BACK_BY_SENTINEL=<value>     the MAINTENANCE_BACK_BY value the build was made with
//   MAINTENANCE_BASELINE_APP_ROUTES=<file>   optional: app-path-routes-manifest.json of a build made
//                                            before this ticket; a wall-off build must list the same routes
// Unset, the gated tests skip with the reason in their title. The scanners themselves are always
// checked against planted directories first.
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { walkAll } from './helpers';

const DIR = process.env.MAINTENANCE_BUILD_DIR ?? '';
const MODE = process.env.MAINTENANCE_BUILD_MODE ?? '';
const LOG = process.env.MAINTENANCE_BUILD_LOG ?? '';
const SENTINEL = process.env.MAINTENANCE_BACK_BY_SENTINEL ?? '';
const SKIP = 'runs only with MAINTENANCE_BUILD_DIR, MAINTENANCE_BUILD_MODE and MAINTENANCE_BUILD_LOG set; skipped when unset';

const EMPTY_MANIFEST = { version: 3, middleware: {}, functions: {}, sortedMiddleware: [] };

function manifestOf(nextDir: string): { middleware?: Record<string, { matchers?: { regexp?: string }[] }> } | null {
  try {
    return JSON.parse(readFileSync(path.join(nextDir, 'server', 'middleware-manifest.json'), 'utf8'));
  } catch {
    return null;
  }
}
const hasFile = (nextDir: string, rel: string) => walkAll(nextDir).includes(path.join(nextDir, rel));

function offBuildProblems(nextDir: string): string[] {
  const p: string[] = [];
  const m = manifestOf(nextDir);
  if (!m) p.push('middleware manifest missing or unreadable');
  else if (JSON.stringify(m) !== JSON.stringify(EMPTY_MANIFEST)) p.push(`middleware manifest is ${JSON.stringify(m)}`);
  if (hasFile(nextDir, 'server/middleware.js')) p.push('server/middleware.js exists');
  return p;
}

function onBuildProblems(nextDir: string): string[] {
  const m = manifestOf(nextDir);
  if (!m) return ['middleware manifest missing or unreadable'];
  const entries = Object.values(m.middleware ?? {});
  if (entries.length !== 1) return [`${entries.length} middleware entries`];
  const regexps = (entries[0].matchers ?? []).map((x) => x.regexp);
  return JSON.stringify(regexps) === JSON.stringify(['^/.*$']) ? [] : [`matchers ${JSON.stringify(regexps)}`];
}

function logProblems(log: string, mode: 'on' | 'off'): string[] {
  const on = (log.match(/\[maintenance\] wall build: ON/g) ?? []).length;
  const off = (log.match(/\[maintenance\] wall build: OFF/g) ?? []).length;
  const p: string[] = [];
  if (mode === 'off' && (off < 1 || on > 0)) p.push(`log has ${off} OFF and ${on} ON lines`);
  if (mode === 'on' && (on < 1 || off > 0)) p.push(`log has ${on} ON and ${off} OFF lines`);
  if (!/\[maintenance\] tripwire ok:/.test(log)) p.push('log has no tripwire success line');
  return p;
}

/** Files under `nextDir` (relative) whose bytes contain `needle`. */
function containing(nextDir: string, needle: string): string[] {
  const n = Buffer.from(needle);
  return walkAll(nextDir).filter((f) => readFileSync(f).includes(n)).map((f) => path.relative(nextDir, f).split(path.sep).join('/'));
}

/** The routes (values) of .next/app-path-routes-manifest.json, sorted, or null when unreadable. */
function appRoutesOf(nextDir: string): string[] | null {
  try {
    return Object.values(JSON.parse(readFileSync(path.join(nextDir, 'app-path-routes-manifest.json'), 'utf8')) as Record<string, string>).sort();
  } catch {
    return null;
  }
}
const CATCH_ALL = '/[[...wall]]';
// A wall build may hold the catch-all, the static icon files and Next's own not-found page, nothing else.
const WALL_ONLY_ROUTES = [CATCH_ALL, '/apple-icon.png', '/favicon.ico', '/icon.svg', '/_not-found'];

function wallRoutesProblems(nextDir: string): string[] {
  const r = appRoutesOf(nextDir);
  if (!r) return ['app-path-routes-manifest.json missing or unreadable'];
  const extra = r.filter((x) => !WALL_ONLY_ROUTES.includes(x));
  const p = extra.length ? [`application routes in a wall build: ${extra.join(', ')}`] : [];
  if (!r.includes(CATCH_ALL)) p.push('no wall catch-all route');
  return p;
}

function normalRoutesProblems(nextDir: string, baseline: string[] | null): string[] {
  const r = appRoutesOf(nextDir);
  if (!r) return ['app-path-routes-manifest.json missing or unreadable'];
  const p = r.includes(CATCH_ALL) ? ['the wall catch-all is a route in a wall-off build'] : [];
  if (baseline && JSON.stringify(r) !== JSON.stringify(baseline)) {
    p.push(`routes differ from the baseline: added ${JSON.stringify(r.filter((x) => !baseline.includes(x)))}, missing ${JSON.stringify(baseline.filter((x) => !r.includes(x)))}`);
  }
  return p;
}

function staticLeakProblems(nextDir: string, sentinel: string, mode: 'on' | 'off'): string[] {
  const p: string[] = [];
  const staticDir = path.join(nextDir, 'static');
  for (const needle of [sentinel, 'MAINTENANCE_', 'wall build']) {
    const hits = containing(staticDir, needle);
    if (hits.length) p.push(`static contains ${needle === sentinel ? 'the sentinel' : needle}: ${hits.join(', ')}`);
  }
  const all = containing(nextDir, sentinel);
  if (mode === 'off') {
    if (all.length) p.push(`sentinel found in a wall-off build: ${all.join(', ')}`);
  } else {
    // cache/ is the local webpack build cache: it holds the compiled middleware too, but it is never
    // served and is not part of the deploy's static output.
    const elsewhere = all.filter((f) => !f.startsWith('server/') && f !== 'required-server-files.json' && !f.startsWith('cache/'));
    if (elsewhere.length) p.push(`sentinel outside server/, cache/ and required-server-files.json: ${elsewhere.join(', ')}`);
    if (!all.some((f) => f.startsWith('server/'))) p.push('sentinel not found under server/');
    if (!all.includes('required-server-files.json')) p.push('sentinel not found in required-server-files.json');
  }
  return p;
}

const temps: string[] = [];
afterAll(() => { for (const t of temps) rmSync(t, { recursive: true, force: true }); });
function plantedNext(files: Record<string, string>): string {
  const root = mkdtempSync(path.join(tmpdir(), 'mp37-next-'));
  temps.push(root);
  for (const [rel, text] of Object.entries(files)) {
    mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
    writeFileSync(path.join(root, rel), text);
  }
  return root;
}

describe('MP-37 built output: the scanners catch planted faults', () => {
  it('the scanners report a planted middleware, an ON line and a sentinel in static', () => {
    const walled = plantedNext({
      'server/middleware-manifest.json': JSON.stringify({ version: 3, middleware: { '/': { matchers: [{ regexp: '^/.*$' }] } }, functions: {}, sortedMiddleware: ['/'] }),
      'server/middleware.js': 'x',
      'static/chunks/app.js': 'var x = "ZZPLANTEDZZ";',
    });
    expect(offBuildProblems(walled)).toEqual([expect.stringMatching(/^middleware manifest is /), 'server/middleware.js exists']);
    expect(onBuildProblems(walled)).toEqual([]);
    expect(logProblems('[maintenance] wall build: OFF\n[maintenance] wall build: ON\n[maintenance] tripwire ok: x', 'off')).toEqual(['log has 1 OFF and 1 ON lines']);
    expect(logProblems('[maintenance] wall build: OFF', 'off')).toEqual(['log has no tripwire success line']);
    expect(staticLeakProblems(walled, 'ZZPLANTEDZZ', 'on')).toEqual([
      'static contains the sentinel: chunks/app.js',
      'sentinel outside server/, cache/ and required-server-files.json: static/chunks/app.js',
      'sentinel not found under server/',
      'sentinel not found in required-server-files.json',
    ]);
    // Route lists: a wall build with an app page left, and a normal build holding the catch-all.
    const routesOf = (r: Record<string, string>) => ({ 'app-path-routes-manifest.json': JSON.stringify(r) });
    expect(wallRoutesProblems(plantedNext(routesOf({ '/[[...wall]]/route': CATCH_ALL, '/icon.svg/route': '/icon.svg', '/privacy/page': '/privacy' })))).toEqual(['application routes in a wall build: /privacy']);
    expect(wallRoutesProblems(plantedNext(routesOf({ '/icon.svg/route': '/icon.svg' })))).toEqual(['no wall catch-all route']);
    expect(wallRoutesProblems(plantedNext(routesOf({ '/[[...wall]]/route': CATCH_ALL, '/_not-found/page': '/_not-found' })))).toEqual([]);
    expect(normalRoutesProblems(plantedNext(routesOf({ '/page': '/', '/[[...wall]]/route': CATCH_ALL })), null)).toEqual(['the wall catch-all is a route in a wall-off build']);
    expect(normalRoutesProblems(plantedNext(routesOf({ '/page': '/', '/terms/page': '/terms' })), ['/', '/privacy'])).toEqual(['routes differ from the baseline: added ["/terms"], missing ["/privacy"]']);
    expect(normalRoutesProblems(plantedNext({}), null)).toEqual(['app-path-routes-manifest.json missing or unreadable']);
    const clean = plantedNext({ 'server/middleware-manifest.json': JSON.stringify(EMPTY_MANIFEST), 'static/chunks/app.js': 'ok' });
    expect(offBuildProblems(clean)).toEqual([]);
    expect(onBuildProblems(clean)).toEqual(['0 middleware entries']);
    expect(staticLeakProblems(clean, 'ZZPLANTEDZZ', 'off')).toEqual([]);
  });
});

describe('MP-37 built output (real build)', () => {
  const BASELINE = process.env.MAINTENANCE_BASELINE_APP_ROUTES ?? '';
  it.skipIf(!(DIR && MODE === 'off'))(`a wall-off build has no wall route and the app routes of a normal build (${SKIP}, mode off; MAINTENANCE_BASELINE_APP_ROUTES compares with a pre-ticket build)`, () => {
    const baseline = BASELINE ? (Object.values(JSON.parse(readFileSync(BASELINE, 'utf8')) as Record<string, string>).sort()) : null;
    expect(normalRoutesProblems(DIR, baseline)).toEqual([]);
    console.log(`wall-off app routes (${appRoutesOf(DIR)?.length}): ${appRoutesOf(DIR)?.join(' ')}${baseline ? ' (equal to the baseline)' : ''}`);
  });

  it.skipIf(!(DIR && MODE === 'on'))(`a wall-on build contains only the wall routes (${SKIP}, mode on)`, () => {
    expect(wallRoutesProblems(DIR)).toEqual([]);
    console.log(`wall-on app routes: ${appRoutesOf(DIR)?.join(' ')}`);
  });

  it.skipIf(!(DIR && LOG && MODE === 'off'))(`a wall-off build has an empty middleware manifest and no middleware.js (${SKIP}, mode off)`, () => {
    expect(offBuildProblems(DIR)).toEqual([]);
    expect(logProblems(readFileSync(LOG, 'utf8'), 'off')).toEqual([]);
  });

  it.skipIf(!(DIR && LOG && MODE === 'on'))(`a wall-on build has one middleware matching every path (${SKIP}, mode on)`, () => {
    expect(onBuildProblems(DIR)).toEqual([]);
    expect(logProblems(readFileSync(LOG, 'utf8'), 'on')).toEqual([]);
    // Sanity: the same directory read as a wall-off build fails.
    expect(offBuildProblems(DIR).length).toBeGreaterThan(0);
  });

  it.skipIf(!(DIR && SENTINEL && (MODE === 'on' || MODE === 'off')))(
    `a wall-on build keeps the wall variables out of .next/static (${SKIP}, plus MAINTENANCE_BACK_BY_SENTINEL)`,
    () => {
      const problems = staticLeakProblems(DIR, SENTINEL, MODE as 'on' | 'off');
      console.log(`sentinel found in: ${JSON.stringify(containing(DIR, SENTINEL))}`);
      expect(problems).toEqual([]);
    },
  );
});
