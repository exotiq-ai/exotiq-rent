// MP-37 AC1: with the wall off, next.config.js exports exactly the 1ac6fde config; with it on, the
// config differs in exactly pageExtensions, redirects (empty) and env (two string keys). The
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
const WALL_EXTENSIONS = ['wall.ts', 'tsx', 'ts', 'jsx', 'js'];
const WALL_ENV_KEYS = ['MAINTENANCE_RETRY_AFTER', 'MAINTENANCE_BACK_BY'];
const WALL_VARS = ['MAINTENANCE_MODE', ...WALL_ENV_KEYS];

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

/** next.config.js evaluated fresh under `env` (undefined deletes a variable). */
function loadConfig(env: Record<string, string | undefined>): { config: Config; lines: string[] } {
  for (const k of [...WALL_VARS, 'NEXT_PUBLIC_SITE_MODE', 'NEXT_PUBLIC_DEFAULT_TEAM_SLUG']) vi.stubEnv(k, undefined);
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
  return { booking: await run(undefined), marketplace: await run('marketplace') };
}

/** Every way `config` departs from the baseline for a wall that is `on` or off. */
function configProblems(config: Config, redirects: { booking?: Redirect[]; marketplace?: Redirect[] }, on: boolean): string[] {
  const p: string[] = [];
  const expectedKeys = on ? [...BASELINE_KEYS, 'pageExtensions', 'env'] : BASELINE_KEYS;
  const keys = Object.keys(config);
  for (const k of keys) if (!expectedKeys.includes(k)) p.push(`unexpected key ${k}`);
  for (const k of expectedKeys) if (!keys.includes(k)) p.push(`missing key ${k}`);
  for (const [k, v] of Object.entries(BASELINE_STATIC)) {
    if (JSON.stringify(config[k]) !== JSON.stringify(v)) p.push(`${k} differs from the baseline`);
  }
  if (typeof config.redirects !== 'function') p.push('redirects is not a function');
  const wantBooking = on ? [] : BASELINE_BOOKING_REDIRECTS;
  if (JSON.stringify(redirects.booking) !== JSON.stringify(wantBooking)) p.push(`redirects (booking mode) are ${JSON.stringify(redirects.booking)}`);
  if (JSON.stringify(redirects.marketplace) !== JSON.stringify([])) p.push(`redirects (marketplace mode) are ${JSON.stringify(redirects.marketplace)}`);
  if (on) {
    if (JSON.stringify(config.pageExtensions) !== JSON.stringify(WALL_EXTENSIONS)) p.push(`pageExtensions are ${JSON.stringify(config.pageExtensions)}`);
    const env = config.env as Record<string, unknown> | undefined;
    const envKeys = env ? Object.keys(env) : [];
    if (JSON.stringify(envKeys.slice().sort()) !== JSON.stringify(WALL_ENV_KEYS.slice().sort())) p.push(`env keys are ${JSON.stringify(envKeys)}`);
    for (const k of envKeys) if (typeof env?.[k] !== 'string') p.push(`env ${k} is not a string`);
  }
  return p;
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
    const plantedRedirect: Config = { ...BASELINE_STATIC, redirects: async () => [], pageExtensions: WALL_EXTENSIONS, env };
    expect(configProblems(plantedRedirect, { booking: BASELINE_BOOKING_REDIRECTS.slice(0, 1), marketplace: [] }, true)).toEqual([
      `redirects (booking mode) are ${JSON.stringify(BASELINE_BOOKING_REDIRECTS.slice(0, 1))}`,
    ]);
    const plantedEnv: Config = { ...plantedRedirect, env: { ...env, EXTRA: 'x' } };
    expect(configProblems(plantedEnv, { booking: [], marketplace: [] }, true)).toEqual([
      `env keys are ${JSON.stringify(['MAINTENANCE_RETRY_AFTER', 'MAINTENANCE_BACK_BY', 'EXTRA'])}`,
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
    console.log(`wall-on key diff: added ${JSON.stringify(added)}; redirects() resolves to []`);
  });

  it('the flags reader prints one agreeing build-log line', () => {
    // Planted: a disagreeing line, and a doubled line, are reported.
    expect(logProblems(['[maintenance] wall build: ON'], false)).toEqual(['printed "[maintenance] wall build: ON" for a wall that is off']);
    expect(logProblems(['[maintenance] wall build: OFF', '[maintenance] wall build: OFF'], false)).toEqual([
      '2 wall build lines: ["[maintenance] wall build: OFF","[maintenance] wall build: OFF"]',
    ]);
    for (const v of ON_VALUES) expect(logProblems(loadConfig({ MAINTENANCE_MODE: v }).lines, true), JSON.stringify(v)).toEqual([]);
    for (const v of OFF_VALUES) expect(logProblems(loadConfig({ MAINTENANCE_MODE: v }).lines, false), JSON.stringify(v)).toEqual([]);
    // The reader on its own prints exactly one line per evaluation too.
    delete require.cache[FLAGS];
    const { readWall } = require(FLAGS) as { readWall: (env?: Record<string, string | undefined>) => { on: boolean } };
    for (const v of [...ON_VALUES, ...OFF_VALUES]) {
      const lines: string[] = [];
      const spy = vi.spyOn(console, 'log').mockImplementation((...a: unknown[]) => { lines.push(a.map(String).join(' ')); });
      const r = readWall({ MAINTENANCE_MODE: v });
      spy.mockRestore();
      expect(logProblems(lines, r.on), JSON.stringify(v)).toEqual([]);
      expect(r.on).toBe(ON_VALUES.includes(v as string));
    }
  });
});
