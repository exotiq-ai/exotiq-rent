// MP-37 AC12: the build tripwire. After a build it compares MAINTENANCE_MODE with the built
// middleware manifest and fails, in one plain sentence, when they disagree in either direction or
// the manifest cannot be read. Each case runs the real script as a child process in a temporary
// directory that holds only the manifest variant.
import { execFile } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { afterAll, describe, expect, it } from 'vitest';
import { ROOT, read } from './helpers';

const run = promisify(execFile);
const SCRIPT = path.join(ROOT, 'scripts/maintenance/assert-build.mjs');
const EMPTY = JSON.stringify({ version: 3, middleware: {}, functions: {}, sortedMiddleware: [] });
const WALLED = JSON.stringify({ version: 3, middleware: { '/': { name: 'middleware', page: '/', matchers: [{ regexp: '^/.*$' }] } }, functions: {}, sortedMiddleware: ['/'] });

const temps: string[] = [];
const matrix: string[] = [];
afterAll(() => {
  for (const t of temps) rmSync(t, { recursive: true, force: true });
  console.log(`tripwire matrix:\n${matrix.join('\n')}`);
});

/** Runs the tripwire in a directory whose manifest is `manifest` (null: none). */
async function tripwire(label: string, mode: string | undefined, manifest: string | null) {
  const dir = mkdtempSync(path.join(tmpdir(), 'mp37-trip-'));
  temps.push(dir);
  if (manifest !== null) {
    mkdirSync(path.join(dir, '.next', 'server'), { recursive: true });
    writeFileSync(path.join(dir, '.next', 'server', 'middleware-manifest.json'), manifest);
  }
  const env: NodeJS.ProcessEnv = { PATH: process.env.PATH ?? '' };
  if (mode !== undefined) env.MAINTENANCE_MODE = mode;
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
  matrix.push(`${label}: MAINTENANCE_MODE=${mode ?? 'unset'} -> exit ${code}: ${lines.join(' | ')}`);
  return { code, lines };
}

const oneSentence = (lines: string[]) => lines.length === 1 && /^\[maintenance\] tripwire failed: [^\n]+\.$/.test(lines[0]);

describe('MP-37 the build tripwire', () => {
  it('tripwire passes when the wall is wanted and a middleware is present', async () => {
    const r = await tripwire('wanted + present', 'on', WALLED);
    expect(r.code).toBe(0);
    expect(r.lines).toEqual(['[maintenance] tripwire ok: the wall was wanted and a middleware was built.']);
    expect((await tripwire('wanted (TRUE) + present', ' TRUE ', WALLED)).code).toBe(0);
  });

  it('tripwire passes when the wall is not wanted and the manifest is empty', async () => {
    for (const mode of [undefined, '', 'off', 'yes']) {
      const r = await tripwire('not wanted + empty', mode, EMPTY);
      expect(r.code, String(mode)).toBe(0);
      expect(r.lines).toEqual(['[maintenance] tripwire ok: the wall was not wanted and no middleware was built.']);
    }
  });

  it('tripwire fails when the wall is wanted but no middleware was built', async () => {
    const r = await tripwire('wanted + empty', 'on', EMPTY);
    expect(r.code).toBe(1);
    expect(oneSentence(r.lines), r.lines.join('|')).toBe(true);
    expect(r.lines[0]).toMatch(/asks for the wall but this build has no middleware/);
  });

  it('tripwire fails when a middleware was built but the wall is not wanted', async () => {
    for (const mode of [undefined, 'off', 'onn']) {
      const r = await tripwire('not wanted + present', mode, WALLED);
      expect(r.code, String(mode)).toBe(1);
      expect(oneSentence(r.lines), r.lines.join('|')).toBe(true);
      expect(r.lines[0]).toMatch(/has a middleware but MAINTENANCE_MODE does not ask for the wall/);
    }
  });

  it('tripwire fails when the manifest is missing or unreadable', async () => {
    for (const [label, manifest] of [['missing', null], ['unparsable', '{not json'], ['no middleware key', '{"version":3}']] as const) {
      for (const mode of ['on', undefined]) {
        const r = await tripwire(`manifest ${label}`, mode, manifest);
        expect(r.code, `${label} ${mode}`).toBe(1);
        expect(oneSentence(r.lines), r.lines.join('|')).toBe(true);
        expect(r.lines[0]).toMatch(/middleware-manifest\.json is missing or unreadable/);
      }
    }
  });

  it('package.json wires the tripwire as postbuild', () => {
    const pkg = JSON.parse(read('package.json')) as { scripts: Record<string, string> };
    expect(pkg.scripts.postbuild).toBe('node scripts/maintenance/assert-build.mjs');
    expect(pkg.scripts.build).toBe('next build');
  });
});
