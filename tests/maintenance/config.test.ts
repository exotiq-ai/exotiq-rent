// MP-37 AC1: with the wall off, next.config.js exports exactly the 1ac6fde config; with it on, the
// config differs in exactly five ways: images (no remote source at all, optimizer off), pageExtensions
// ['wall.ts', 'wall.tsx'] (so only the wall files
// are compiled), generateBuildId (the fixed id 'maintenance-wall'), redirects (empty) and env (two
// string keys). The
// baseline is embedded below as literals (never read from git). Each case evaluates next.config.js
// and the flags reader fresh, so the environment of that case is the one the config sees.
import { createRequire } from 'node:module';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { OFF_VALUES, ON_VALUES, ROOT } from './helpers';

const require = createRequire(import.meta.url);
const CONFIG = path.join(ROOT, 'next.config.js');
const FLAGS = path.join(ROOT, 'domain/maintenance/flags.js');

type Redirect = { source: string; destination: string; permanent: boolean };
type Config = Record<string, unknown> & { redirects?: () => Promise<Redirect[]> };

const BASELINE_KEYS = ['redirects', 'images', 'compress', 'poweredByHeader', 'swcMinify', 'reactStrictMode'];
const BASELINE_STATIC = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'images.unsplash.com', pathname: '/**' },
      { protocol: 'https', hostname: '*.supabase.co', pathname: '/storage/**' },
    ],
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048],
    minimumCacheTTL: 2678400,
  },
  compress: true,
  poweredByHeader: false,
  swcMinify: true,
  reactStrictMode: true,
};
const BASELINE_BOOKING_REDIRECTS: Redirect[] = [
  { source: '/', destination: '/desert-exotic-rentals', permanent: false },
  { source: '/exotiq-', destination: '/exotiq', permanent: false },
  { source: '/exotiq-/:path*', destination: '/exotiq/:path*', permanent: false },
  { source: '/share/exotiq-/:path*', destination: '/share/exotiq/:path*', permanent: false },
];
const WALL_EXTENSIONS = ['wall.ts', 'wall.tsx'];
const WALL_BUILD_ID = 'maintenance-wall';
// A wall build allows no remote image source and turns the image optimizer off.
const WALL_IMAGES = { unoptimized: true, remotePatterns: [] };
const WALL_ENV_KEYS = ['MAINTENANCE_RETRY_AFTER', 'MAINTENANCE_BACK_BY'];
const WALL_VARS = ['MAINTENANCE_MODE', ...WALL_ENV_KEYS];

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

/** next.config.js evaluated fresh under `env` (undefined deletes a variable). */
function loadConfig(env: Record<string, string | undefined>): { config: Config; lines: string[] } {
  for (const k of [...WALL_VARS, 'NEXT_PUBLIC_SITE_MODE', 'NEXT_PUBLIC_DEFAULT_TEAM_SLUG', 'NEXT_PHASE']) vi.stubEnv(k, undefined);
  for (const [k, v] of Object.entries(env)) vi.stubEnv(k, v);
  delete require.cache[CONFIG];
  delete require.cache[FLAGS];
  const lines: string[] = [];
  const spy = vi.spyOn(console, 'log').mockImplementation((...a: unknown[]) => { lines.push(a.map(String).join(' ')); });
  try {
    return { config: require(CONFIG) as Config, lines };
  } finally {
    spy.mockRestore();
  }
}

/** redirects() for booking mode and for marketplace mode, with the site variables of each. */
async function redirectsOf(config: Config, env: Record<string, string | undefined>) {
  const run = async (mode: string | undefined) => {
    vi.stubEnv('NEXT_PUBLIC_SITE_MODE', mode);
    for (const [k, v] of Object.entries(env)) vi.stubEnv(k, v);
    return config.redirects ? await config.redirects() : undefined;
  };
  const buildId = typeof config.generateBuildId === 'function' ? await (config.generateBuildId as () => Promise<unknown>)() : undefined;
  return { booking: await run(undefined), marketplace: await run('marketplace'), buildId };
}

/** Every way `config` departs from the baseline for a wall that is `on` or off. */
function configProblems(config: Config, redirects: { booking?: Redirect[]; marketplace?: Redirect[]; buildId?: unknown }, on: boolean): string[] {
  const p: string[] = [];
  const expectedKeys = on ? [...BASELINE_KEYS, 'pageExtensions', 'generateBuildId', 'env'] : BASELINE_KEYS;
  const keys = Object.keys(config);
  for (const k of keys) if (!expectedKeys.includes(k)) p.push(`unexpected key ${k}`);
  for (const k of expectedKeys) if (!keys.includes(k)) p.push(`missing key ${k}`);
  for (const [k, v] of Object.entries(BASELINE_STATIC)) {
    if (on && k === 'images') {
      if (JSON.stringify(config.images) !== JSON.stringify(WALL_IMAGES)) p.push(`images in a wall build are ${JSON.stringify(config.images)}`);
      continue;
    }
    if (JSON.stringify(config[k]) !== JSON.stringify(v)) p.push(`${k} differs from the baseline`);
  }
  if (typeof config.redirects !== 'function') p.push('redirects is not a function');
  const wantBooking = on ? [] : BASELINE_BOOKING_REDIRECTS;
  if (JSON.stringify(redirects.booking) !== JSON.stringify(wantBooking)) p.push(`redirects (booking mode) are ${JSON.stringify(redirects.booking)}`);
  if (JSON.stringify(redirects.marketplace) !== JSON.stringify([])) p.push(`redirects (marketplace mode) are ${JSON.stringify(redirects.marketplace)}`);
  if (on) {
    if (JSON.stringify(config.pageExtensions) !== JSON.stringify(WALL_EXTENSIONS)) p.push(`pageExtensions are ${JSON.stringify(config.pageExtensions)}`);
    if (redirects.buildId !== WALL_BUILD_ID) p.push(`generateBuildId gives ${JSON.stringify(redirects.buildId)}`);
    const env = config.env as Record<string, unknown> | undefined;
    const envKeys = env ? Object.keys(env) : [];
    if (JSON.stringify(envKeys.slice().sort()) !== JSON.stringify(WALL_ENV_KEYS.slice().sort())) p.push(`env keys are ${JSON.stringify(envKeys)}`);
    for (const k of envKeys) if (typeof env?.[k] !== 'string') p.push(`env ${k} is not a string`);
  }
  return p;
}

const BUILD_PHASE = 'phase-production-build';
const BUILD_ARGV = ['/usr/local/bin/node', '/repo/node_modules/next/dist/bin/next', 'build'];
const BUILD_ARGV_BIN = ['/usr/local/bin/node', '/repo/node_modules/.bin/next', 'build', '--no-lint'];
const WORKER_ARGV = ['/usr/local/bin/node', '/repo/node_modules/next/dist/compiled/jest-worker/processChild.js'];

type ReadWall = (env?: Record<string, string | undefined>, argv?: string[]) => { on: boolean };
/** readWall from a fresh flags.js with an explicit environment and argv, and the lines it printed. */
function readWallLines(env: Record<string, string | undefined>, argv: string[]) {
  delete require.cache[FLAGS];
  const { readWall } = require(FLAGS) as { readWall: ReadWall };
  const lines: string[] = [];
  const spy = vi.spyOn(console, 'log').mockImplementation((...a: unknown[]) => { lines.push(a.map(String).join(' ')); });
  try {
    return { lines, result: readWall(env, argv) };
  } finally {
    spy.mockRestore();
  }
}

/** Outside a build, no wall line at all. */
function silentProblems(lines: string[]): string[] {
  const wall = lines.filter((l) => l.includes('[maintenance] wall build:'));
  return wall.length ? [`printed ${JSON.stringify(wall)} outside a build`] : [];
}

/** The build-log lines printed by one evaluation agree with the parsed value. */
function logProblems(lines: string[], on: boolean): string[] {
  const wall = lines.filter((l) => l.includes('[maintenance] wall build:'));
  const want = `[maintenance] wall build: ${on ? 'ON' : 'OFF'}`;
  if (wall.length !== 1) return [`${wall.length} wall build lines: ${JSON.stringify(wall)}`];
  return wall[0] === want ? [] : [`printed ${JSON.stringify(wall[0])} for a wall that is ${on ? 'on' : 'off'}`];
}

describe('MP-37 next.config and the wall', () => {
  it('next.config deep-equals the 1ac6fde baseline when the wall is off', async () => {
    // Planted: a config that adds pageExtensions with the wall off is reported by name.
    const planted: Config = { ...BASELINE_STATIC, redirects: async () => BASELINE_BOOKING_REDIRECTS, pageExtensions: WALL_EXTENSIONS };
    expect(configProblems(planted, { booking: BASELINE_BOOKING_REDIRECTS, marketplace: [] }, false)).toEqual(['unexpected key pageExtensions']);
    for (const v of OFF_VALUES) {
      const { config } = loadConfig({ MAINTENANCE_MODE: v, MAINTENANCE_RETRY_AFTER: '900', MAINTENANCE_BACK_BY: 'nine' });
      const redirects = await redirectsOf(config, {});
      expect(configProblems(config, redirects, false), `MAINTENANCE_MODE=${JSON.stringify(v)}`).toEqual([]);
    }
    console.log(`baseline keys: ${JSON.stringify(BASELINE_KEYS)}`);
  });

  it('next.config differs from the baseline in exactly pageExtensions, redirects and env when the wall is on', async () => {
    // Planted: a redirects() that keeps the root redirect, and an extra env key, are each reported.
    const env = { MAINTENANCE_RETRY_AFTER: '', MAINTENANCE_BACK_BY: '' };
    const plantedRedirect: Config = { ...BASELINE_STATIC, images: WALL_IMAGES, redirects: async () => [], pageExtensions: WALL_EXTENSIONS, generateBuildId: async () => WALL_BUILD_ID, env };
    // Planted: a wall build that keeps the normal remote allow-list is reported.
    expect(configProblems({ ...plantedRedirect, images: BASELINE_STATIC.images }, { booking: [], marketplace: [], buildId: WALL_BUILD_ID }, true)).toEqual([
      `images in a wall build are ${JSON.stringify(BASELINE_STATIC.images)}`,
    ]);
    expect(configProblems(plantedRedirect, { booking: BASELINE_BOOKING_REDIRECTS.slice(0, 1), marketplace: [], buildId: WALL_BUILD_ID }, true)).toEqual([
      `redirects (booking mode) are ${JSON.stringify(BASELINE_BOOKING_REDIRECTS.slice(0, 1))}`,
    ]);
    const plantedEnv: Config = { ...plantedRedirect, env: { ...env, EXTRA: 'x' } };
    expect(configProblems(plantedEnv, { booking: [], marketplace: [], buildId: WALL_BUILD_ID }, true)).toEqual([
      `env keys are ${JSON.stringify(['MAINTENANCE_RETRY_AFTER', 'MAINTENANCE_BACK_BY', 'EXTRA'])}`,
    ]);
    // Planted: the old one-file pageExtensions (the whole app would still be compiled) and a random build id.
    const plantedOld: Config = { ...plantedRedirect, pageExtensions: ['wall.ts', 'tsx', 'ts', 'jsx', 'js'] };
    expect(configProblems(plantedOld, { booking: [], marketplace: [], buildId: 'x1' }, true)).toEqual([
      'pageExtensions are ["wall.ts","tsx","ts","jsx","js"]',
      'generateBuildId gives "x1"',
    ]);
    for (const v of ON_VALUES) {
      const { config } = loadConfig({ MAINTENANCE_MODE: v });
      const redirects = await redirectsOf(config, { MAINTENANCE_MODE: v });
      expect(configProblems(config, redirects, true), `MAINTENANCE_MODE=${JSON.stringify(v)}`).toEqual([]);
      expect(config.env).toEqual({ MAINTENANCE_RETRY_AFTER: '', MAINTENANCE_BACK_BY: '' });
    }
    const { config } = loadConfig({ MAINTENANCE_MODE: 'on', MAINTENANCE_RETRY_AFTER: '900', MAINTENANCE_BACK_BY: 'nine thirty' });
    expect(config.env).toEqual({ MAINTENANCE_RETRY_AFTER: '900', MAINTENANCE_BACK_BY: 'nine thirty' });
    const added = Object.keys(config).filter((k) => !BASELINE_KEYS.includes(k));
    console.log(`wall-on key diff: added ${JSON.stringify(added)}; pageExtensions ${JSON.stringify(config.pageExtensions)}; build id ${JSON.stringify((await redirectsOf(config, {})).buildId)}; redirects() resolves to []`);
  });

  it('the flags reader prints one agreeing build-log line', () => {
    // Planted: a disagreeing line, and a doubled line, are reported.
    expect(logProblems(['[maintenance] wall build: ON'], false)).toEqual(['printed "[maintenance] wall build: ON" for a wall that is off']);
    expect(logProblems(['[maintenance] wall build: OFF', '[maintenance] wall build: OFF'], false)).toEqual([
      '2 wall build lines: ["[maintenance] wall build: OFF","[maintenance] wall build: OFF"]',
    ]);
    // Through next.config.js, in a build (Next sets NEXT_PHASE in its build workers).
    for (const v of ON_VALUES) expect(logProblems(loadConfig({ MAINTENANCE_MODE: v, NEXT_PHASE: BUILD_PHASE }).lines, true), JSON.stringify(v)).toEqual([]);
    for (const v of OFF_VALUES) expect(logProblems(loadConfig({ MAINTENANCE_MODE: v, NEXT_PHASE: BUILD_PHASE }).lines, false), JSON.stringify(v)).toEqual([]);
    // The reader on its own, in the `next build` process itself (arguments) and in a build worker (phase).
    for (const v of [...ON_VALUES, ...OFF_VALUES]) {
      for (const [env, argv] of [[{}, BUILD_ARGV], [{}, BUILD_ARGV_BIN], [{ NEXT_PHASE: BUILD_PHASE }, WORKER_ARGV]] as const) {
        const { lines, result } = readWallLines({ ...env, MAINTENANCE_MODE: v }, [...argv]);
        expect(logProblems(lines, result.on), `${JSON.stringify(v)} ${argv.join(' ')}`).toEqual([]);
        expect(result.on).toBe(ON_VALUES.includes(v as string));
      }
    }
  });

  it('the flags reader prints nothing outside a build', () => {
    // Planted: a reader that prints on every evaluation is reported.
    expect(silentProblems(['[maintenance] wall build: OFF'])).toEqual(['printed ["[maintenance] wall build: OFF"] outside a build']);
    const outside: [Record<string, string>, string[], string][] = [
      [{}, ['node', '/repo/node_modules/next/dist/bin/next', 'start', '-p', '4000'], 'next start'],
      [{}, ['node', '/repo/node_modules/.bin/next', 'dev'], 'next dev'],
      [{}, ['node', '/repo/node_modules/.bin/next', 'lint'], 'next lint'],
      [{ NEXT_PHASE: 'phase-production-server' }, ['node', '/var/task/server.js'], 'a deployed server'],
      [{}, ['node', '/repo/node_modules/vitest/vitest.mjs', 'run'], 'a test run'],
      [{}, ['node', '/repo/scripts/build.js', 'build'], 'some other script called with build'],
    ];
    for (const v of ['on', 'off', undefined]) {
      for (const [env, argv, name] of outside) {
        const { lines, result } = readWallLines({ ...env, MAINTENANCE_MODE: v }, argv);
        expect(silentProblems(lines), `${name} ${v}`).toEqual([]);
        expect(result.on).toBe(v === 'on');
      }
      // Through next.config.js outside a build (this test process is not `next build`).
      expect(silentProblems(loadConfig({ MAINTENANCE_MODE: v }).lines), String(v)).toEqual([]);
    }
  });
});
