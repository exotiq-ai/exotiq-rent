// MP-37 AC12: the build tripwire. After a build it asks whether the WALL middleware was built (the
// files the middleware manifest lists carry the wall's marker header name) and compares that with
// MAINTENANCE_MODE. It fails, in one plain sentence, when they disagree in either direction, when
// the wall is wanted but the build's middleware is not the wall, or when the manifest or a file it
// lists cannot be read. A non-wall middleware in a normal build is fine. It also reads the app
// routes manifest: a wall build must hold the wall's catch-all route and nothing else but the
// static icons and Next's own not-found page; a normal build must not hold the catch-all. A wall
// build must also allow no remote image source (images manifest, and the copy of the config in
// required-server-files.json when present); a normal build is not checked for that. Each case
// runs the real script as a child process in a temporary directory that holds only that variant.
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

const APP = '.next/app-path-routes-manifest.json';
// What a wall build's app routes manifest holds: the catch-all, the static icons, Next's not-found.
const WALL_ROUTES = { '/[[...wall]]/route': '/[[...wall]]', '/apple-icon.png/route': '/apple-icon.png', '/icon.svg/route': '/icon.svg', '/favicon.ico/route': '/favicon.ico', '/_not-found/page': '/_not-found' };
// A few of a normal build's routes.
const NORMAL_ROUTES = { '/page': '/', '/privacy/page': '/privacy', '/api/renters/capture/route': '/api/renters/capture', '/icon.svg/route': '/icon.svg', '/_not-found/page': '/_not-found' };
const routes = (r: Record<string, string>) => JSON.stringify(r);
const IMAGES = '.next/images-manifest.json';
const RSF = '.next/required-server-files.json';
const images = (extra: Record<string, unknown>) => JSON.stringify({ version: 1, images: { unoptimized: true, domains: [], remotePatterns: [], sizes: [640], ...extra } });
const REMOTE = [{ protocol: 'https', hostname: '^(?:images\\.unsplash\\.com)$', pathname: '^(?:\\/.*)$' }];
const WALL_MW = { [MANIFEST]: manifest(FILES), '.next/server/edge-runtime-webpack.js': 'var runtime=1;', '.next/server/middleware.js': WALL_JS, [IMAGES]: images({}) };
const NO_MW = { [MANIFEST]: manifest(null) };

const BUILDS: Record<string, Build> = {
  none: { ...NO_MW, [APP]: routes(NORMAL_ROUTES) },
  wall: { ...WALL_MW, [APP]: routes(WALL_ROUTES) },
  other: { [MANIFEST]: manifest(FILES), '.next/server/edge-runtime-webpack.js': 'var runtime=1;', '.next/server/middleware.js': OTHER_JS, [APP]: routes(NORMAL_ROUTES) },
  listedFileMissing: { [MANIFEST]: manifest(FILES), '.next/server/edge-runtime-webpack.js': 'var runtime=1;', [APP]: routes(NORMAL_ROUTES) },
  noManifest: {},
  unparsable: { [MANIFEST]: '{not json', [APP]: routes(NORMAL_ROUTES) },
  noMiddlewareKey: { [MANIFEST]: '{"version":3}', [APP]: routes(NORMAL_ROUTES) },
  wallWithAppRoutes: { ...WALL_MW, [APP]: routes({ ...WALL_ROUTES, '/privacy/page': '/privacy', '/api/renters/capture/route': '/api/renters/capture' }) },
  wallWithoutCatchAll: { ...WALL_MW, [APP]: routes({ '/icon.svg/route': '/icon.svg', '/_not-found/page': '/_not-found' }) },
  normalWithCatchAll: { ...NO_MW, [APP]: routes({ ...NORMAL_ROUTES, '/[[...wall]]/route': '/[[...wall]]' }) },
  appManifestMissing: { ...NO_MW },
  appManifestUnparsable: { ...WALL_MW, [APP]: '{not json' },
  wallRemotePattern: { ...WALL_MW, [APP]: routes(WALL_ROUTES), [IMAGES]: images({ remotePatterns: REMOTE }) },
  wallDomains: { ...WALL_MW, [APP]: routes(WALL_ROUTES), [IMAGES]: images({ domains: ['cdn.example.test'] }) },
  wallServerFilesRemote: { ...WALL_MW, [APP]: routes(WALL_ROUTES), [RSF]: JSON.stringify({ version: 1, config: { images: { remotePatterns: [{ hostname: 'cdn.example.test' }], domains: [] } } }) },
  wallServerFilesClean: { ...WALL_MW, [APP]: routes(WALL_ROUTES), [RSF]: JSON.stringify({ version: 1, config: { images: { unoptimized: true, remotePatterns: [], domains: [] } } }) },
  wallNoImagesManifest: { [MANIFEST]: manifest(FILES), '.next/server/edge-runtime-webpack.js': 'var runtime=1;', '.next/server/middleware.js': WALL_JS, [APP]: routes(WALL_ROUTES) },
  wallImagesUnparsable: { ...WALL_MW, [APP]: routes(WALL_ROUTES), [IMAGES]: '{not json' },
  normalRemote: { ...NO_MW, [APP]: routes(NORMAL_ROUTES), [IMAGES]: images({ unoptimized: false, remotePatterns: REMOTE, domains: ['cdn.example.test'] }) },
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
    expect(r.lines).toEqual(['[maintenance] tripwire ok: the wall was wanted, and the wall middleware and the wall-only app were built.']);
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

  it('tripwire fails when a wall build still contains application routes', async () => {
    const r = await tripwire('wanted + app routes left', 'on', 'wallWithAppRoutes');
    expect(r.code).toBe(1);
    expect(oneSentence(r.lines), r.lines.join('|')).toBe(true);
    expect(r.lines[0]).toBe('[maintenance] tripwire failed: this wall build still contains application routes (/privacy, /api/renters/capture), so the app behind the wall could still answer.');
    const n = await tripwire('wanted + no catch-all', 'on', 'wallWithoutCatchAll');
    expect(n.code).toBe(1);
    expect(oneSentence(n.lines), n.lines.join('|')).toBe(true);
    expect(n.lines[0]).toMatch(/has no wall catch-all route/);
  });

  it('tripwire fails when a wall build still allows a remote image source', async () => {
    for (const [build, needle] of [['wallRemotePattern', 'images.unsplash.com'], ['wallDomains', 'cdn.example.test'], ['wallServerFilesRemote', 'cdn.example.test']] as const) {
      const r = await tripwire('wanted + remote images', 'on', build);
      expect(r.code, build).toBe(1);
      expect(oneSentence(r.lines), r.lines.join('|')).toBe(true);
      expect(r.lines[0], build).toMatch(/^\[maintenance\] tripwire failed: this wall build still allows remote image sources \(/);
      expect(r.lines[0], build).toContain(needle);
    }
    // A clean copy of the config in required-server-files.json passes.
    expect((await tripwire('wanted + clean server files', 'on', 'wallServerFilesClean')).code).toBe(0);
    // A wall build without a readable images manifest fails closed.
    for (const build of ['wallNoImagesManifest', 'wallImagesUnparsable'] as const) {
      const r = await tripwire('wanted + images manifest unreadable', 'on', build);
      expect(r.code, build).toBe(1);
      expect(r.lines[0]).toMatch(/images-manifest\.json is missing or unreadable, so this build cannot be checked/);
    }
    // A normal build is not checked for this: its own allow-list, or no images manifest at all, is fine.
    for (const build of ['normalRemote', 'none'] as const) {
      const r = await tripwire('not wanted + images not checked', undefined, build);
      expect(r.code, build).toBe(0);
    }
  });

  it('tripwire fails when a normal build contains the wall catch-all route', async () => {
    for (const mode of [undefined, 'off']) {
      const r = await tripwire('not wanted + catch-all', mode, 'normalWithCatchAll');
      expect(r.code, String(mode)).toBe(1);
      expect(oneSentence(r.lines), r.lines.join('|')).toBe(true);
      expect(r.lines[0]).toMatch(/contains the wall's catch-all route but MAINTENANCE_MODE does not ask for the wall/);
    }
  });

  it('tripwire fails when the manifest is missing or unreadable', async () => {
    for (const build of ['appManifestMissing', 'appManifestUnparsable'] as const) {
      for (const mode of ['on', undefined]) {
        const r = await tripwire('app manifest unreadable', mode, build);
        expect(r.code, `${build} ${mode}`).toBe(1);
        expect(oneSentence(r.lines), r.lines.join('|')).toBe(true);
        expect(r.lines[0]).toMatch(/is missing or unreadable, so this build cannot be checked/);
      }
    }
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
