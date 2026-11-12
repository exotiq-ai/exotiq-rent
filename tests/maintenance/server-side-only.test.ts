// MP-37 AC7 (source half): the wall variables never carry the browser-exposed prefix anywhere in the
// source, MAINTENANCE_MODE is read only by the flags reader (scripts, docs and these tests may name
// it), and nothing under app/ or components/ names any MAINTENANCE_ variable. The prefixed name is
// assembled from fragments so this file cannot trip its own scan. The built-output half of AC7
// lives in build.output.test.ts.
import { describe, expect, it } from 'vitest';
import { read, walkText } from './helpers';

const PUBLIC_PREFIX = ['NEXT', 'PUBLIC', ''].join('_');
const WALL_NAMES = ['MAINTENANCE_MODE', 'MAINTENANCE_RETRY_AFTER', 'MAINTENANCE_BACK_BY'];
const DIRS = ['app', 'components', 'domain', 'lib', 'scripts', 'tests', 'docs', 'netlify', 'next.config.js', 'middleware.wall.ts', 'netlify.toml', 'package.json'];

const mayNameMode = (f: string) =>
  f === 'domain/maintenance/flags.js' || f.startsWith('scripts/maintenance/') || f.startsWith('docs/') || f.startsWith('tests/maintenance/') || f === 'netlify.toml';

function serverSideProblems(files: Record<string, string>): string[] {
  const p: string[] = [];
  for (const [f, text] of Object.entries(files)) {
    if (text.includes(`${PUBLIC_PREFIX}MAINTENANCE`)) p.push(`${f}: names a wall variable with the browser prefix`);
    if (text.includes('MAINTENANCE_MODE') && !mayNameMode(f)) p.push(`${f}: names MAINTENANCE_MODE`);
    if ((f.startsWith('app/') || f.startsWith('components/')) && text.includes('MAINTENANCE_')) p.push(`${f}: names a MAINTENANCE_ variable`);
  }
  return p;
}

describe('MP-37 the wall variables stay on the server', () => {
  it('no NEXT_PUBLIC name for the wall variables exists in the source', () => {
    // Planted: the prefixed name in a domain file is reported.
    expect(serverSideProblems({ 'domain/x.ts': `process.env.${PUBLIC_PREFIX}MAINTENANCE_MODE` })).toEqual([
      'domain/x.ts: names a wall variable with the browser prefix',
      'domain/x.ts: names MAINTENANCE_MODE',
    ]);
    const files = walkText(DIRS);
    expect(files.length).toBeGreaterThan(100);
    const prefixed = files.filter((f) => WALL_NAMES.some((n) => read(f).includes(PUBLIC_PREFIX + n)) || read(f).includes(`${PUBLIC_PREFIX}MAINTENANCE`));
    expect(prefixed).toEqual([]);
  });

  it('the wall variable is read only by the flags reader', () => {
    // Planted: a component reading the wall variable is reported twice (mode and app/components rule).
    expect(serverSideProblems({ 'components/Banner.tsx': 'if (process.env.MAINTENANCE_MODE) {}' })).toEqual([
      'components/Banner.tsx: names MAINTENANCE_MODE',
      'components/Banner.tsx: names a MAINTENANCE_ variable',
    ]);
    expect(serverSideProblems({ 'app/page.tsx': 'process.env.MAINTENANCE_BACK_BY' })).toEqual(['app/page.tsx: names a MAINTENANCE_ variable']);
    const files = Object.fromEntries(walkText(DIRS).map((f) => [f, read(f)]));
    expect(serverSideProblems(files)).toEqual([]);
    // The reader exists and is the one source file that names it (netlify.toml on the wall branch
    // sets it for preview builds; it does not read it).
    const readers = Object.keys(files).filter(
      (f) => !f.startsWith('tests/') && !f.startsWith('docs/') && !f.startsWith('scripts/') && f !== 'netlify.toml' && files[f].includes('MAINTENANCE_MODE'),
    );
    expect(readers).toEqual(['domain/maintenance/flags.js']);
  });
});
