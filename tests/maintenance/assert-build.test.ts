// MP-37 AC12: the build tripwire. After a build it asks whether the WALL middleware was built (the
// files the middleware manifest lists carry the wall's marker header name) and compares that with
// MAINTENANCE_MODE. It fails, in one plain sentence, when they disagree in either direction, when
// the wall is wanted but the build's middleware is not the wall, or when the manifest or a file it
// lists cannot be read. A non-wall middleware in a normal build is fine. Each case runs the real
// script as a child process in a temporary directory that holds only that build variant.
import { execFile } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { afterAll, describe, expect, it } from 'vitest';
import { ROOT, read } from './helpers';

const run = promisify(execFile);
const SCRIPT = path.join(ROOT, 'scripts/maintenance/assert-build.mjs');

type Build = Record<string, string>;
const MANIFEST = '.next/server/middleware-manifest.json';
const manifest = (files: string[] | null) =>
  JSON.stringify(
    files === null
      ? { version: 3, middleware: {}, functions: {}, sortedMiddleware: [] }
      : { version: 3, middleware: { '/': { files, name: 'middleware', page: '/', matchers: [{ regexp: '^/.*$' }] } }, functions: {}, sortedMiddleware: ['/'] },
  );
const FILES = ['server/edge-runtime-webpack.js', 'server/middleware.js'];
// Minified-looking stand-ins for what Next writes. Only the wall's carries the marker header name.
const WALL_JS = '(self._ENTRIES=self._ENTRIES||{}).middleware_middleware=function(){let t=new Headers({"Retry-After":"1800","X-Exotiq-Maintenance":"on"});return new Response(null,{status:503,headers:t})};';
const OTHER_JS = '(self._ENTRIES=self._ENTRIES||{}).middleware_middleware=function(){return new Response(null,{headers:{"x-middleware-next":"1"}})};';

const BUILDS: Record<string, Build> = {
  none: { [MANIFEST]: manifest(null) },
  wall: { [MANIFEST]: manifest(FILES), '.next/server/edge-runtime-webpack.js': 'var runtime=1;', '.next/server/middleware.js': WALL_JS },
  other: { [MANIFEST]: manifest(FILES), '.next/server/edge-runtime-webpack.js': 'var runtime=1;', '.next/server/middleware.js': OTHER_JS },
  listedFileMissing: { [MANIFEST]: manifest(FILES), '.next/server/edge-runtime-webpack.js': 'var runtime=1;' },
  noManifest: {},
  unparsable: { [MANIFEST]: '{not json' },
  noMiddlewareKey: { [MANIFEST]: '{"version":3}' },
};

const temps: string[] = [];
const matrix: string[] = [];
afterAll(() => {
  for (const t of temps) rmSync(t, { recursive: true, force: true });
  console.log(`tripwire matrix:\n${matrix.join('\n')}`);
});

/** Runs the tripwire in a directory that holds the build variant `build`. */
async function tripwire(label: string, mode: string | undefined, build: keyof typeof BUILDS) {
  const dir = mkdtempSync(path.join(tmpdir(), 'mp37-trip-'));
  temps.push(dir);
  for (const [rel, text] of Object.entries(BUILDS[build])) {
    mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
    writeFileSync(path.join(dir, rel), text);
  }
  // Only PATH and, per case, the wall variable: nothing from the test's own environment leaks in.
  const vars: Record<string, string> = { PATH: process.env.PATH ?? '' };
  if (mode !== undefined) vars.MAINTENANCE_MODE = mode;
  const env = vars as NodeJS.ProcessEnv;
  let code = 0;
  let out = '';
  try {
    const r = await run(process.execPath, [SCRIPT], { cwd: dir, env });
    out = `${r.stdout}${r.stderr}`;
  } catch (e) {
    const err = e as { code?: number; stdout?: string; stderr?: string };
    code = typeof err.code === 'number' ? err.code : -1;
    out = `${err.stdout ?? ''}${err.stderr ?? ''}`;
  }
  const lines = out.trim().split('\n').filter(Boolean);
  matrix.push(`${label} (${build}): MAINTENANCE_MODE=${mode ?? 'unset'} -> exit ${code}: ${lines.join(' | ')}`);
  return { code, lines };
}

const oneSentence = (lines: string[]) => lines.length === 1 && /^\[maintenance\] tripwire failed: [^\n]+\.$/.test(lines[0]);

describe('MP-37 the build tripwire', () => {
  it('tripwire passes when the wall is wanted and a middleware is present', async () => {
    const r = await tripwire('wanted + wall built', 'on', 'wall');
    expect(r.code).toBe(0);
    expect(r.lines).toEqual(['[maintenance] tripwire ok: the wall was wanted and the wall middleware was built.']);
    expect((await tripwire('wanted (TRUE) + wall built', ' TRUE ', 'wall')).code).toBe(0);
  });

  it('tripwire passes when the wall is not wanted and the manifest is empty', async () => {
    for (const mode of [undefined, '', 'off', 'yes']) {
      const r = await tripwire('not wanted + no middleware', mode, 'none');
      expect(r.code, String(mode)).toBe(0);
      expect(r.lines).toEqual(['[maintenance] tripwire ok: the wall was not wanted and no middleware was built.']);
    }
  });

  it('tripwire passes when the wall is not wanted and a non-wall middleware is present', async () => {
    for (const mode of [undefined, 'off']) {
      const r = await tripwire('not wanted + other middleware', mode, 'other');
      expect(r.code, String(mode)).toBe(0);
      expect(r.lines).toEqual(['[maintenance] tripwire ok: the wall was not wanted and is not in this build; a non-wall middleware is present.']);
    }
  });

  it('tripwire fails when the wall is wanted but no middleware was built', async () => {
    const r = await tripwire('wanted + no middleware', 'on', 'none');
    expect(r.code).toBe(1);
    expect(oneSentence(r.lines), r.lines.join('|')).toBe(true);
    expect(r.lines[0]).toMatch(/asks for the wall but this build has no middleware/);
  });

  it('tripwire fails when the wall is wanted but the middleware is not the wall', async () => {
    const r = await tripwire('wanted + other middleware', 'on', 'other');
    expect(r.code).toBe(1);
    expect(oneSentence(r.lines), r.lines.join('|')).toBe(true);
    expect(r.lines[0]).toMatch(/asks for the wall but the middleware in this build is not the wall/);
  });

  it('tripwire fails when a middleware was built but the wall is not wanted', async () => {
    for (const mode of [undefined, 'off', 'onn']) {
      const r = await tripwire('not wanted + wall built', mode, 'wall');
      expect(r.code, String(mode)).toBe(1);
      expect(oneSentence(r.lines), r.lines.join('|')).toBe(true);
      expect(r.lines[0]).toMatch(/contains the wall middleware but MAINTENANCE_MODE does not ask for the wall/);
    }
  });

  it('tripwire fails when the manifest is missing or unreadable', async () => {
    for (const build of ['noManifest', 'unparsable', 'noMiddlewareKey', 'listedFileMissing'] as const) {
      for (const mode of ['on', undefined]) {
        const r = await tripwire('unreadable', mode, build);
        expect(r.code, `${build} ${mode}`).toBe(1);
        expect(oneSentence(r.lines), r.lines.join('|')).toBe(true);
        expect(r.lines[0]).toMatch(/is missing or unreadable, so this build cannot be checked/);
      }
    }
  });

  it('package.json wires the tripwire as postbuild', () => {
    const pkg = JSON.parse(read('package.json')) as { scripts: Record<string, string> };
    expect(pkg.scripts.postbuild).toBe('node scripts/maintenance/assert-build.mjs');
    expect(pkg.scripts.build).toBe('next build');
  });
});
