// MP-37 AC21: the feature change stays inside its allowed paths. The checker is always run on
// planted change lists; the real diff runs only with MP37_BASE_REF set, and only on the feature
// branch (the maintenance-wall branch adds netlify.toml on purpose; netlify-toml.test.ts covers it).
import { execFileSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import { ROOT } from './helpers';

const ALLOWED_FILES = ['middleware.wall.ts', 'next.config.js', 'package.json', 'docs/rent/MAINTENANCE_WALL.md', 'tests/polish/golden/census.base.json'];
const ALLOWED_DIRS = ['domain/maintenance/', 'scripts/maintenance/', 'tests/maintenance/'];

function outOfScope(changed: string[]): string[] {
  return changed.filter((f) => f && !ALLOWED_FILES.includes(f) && !ALLOWED_DIRS.some((d) => f.startsWith(d)));
}

describe('MP-37 scope fence', () => {
  it('the change touches only the allowed paths', () => {
    // Planted change lists.
    expect(outOfScope(['domain/maintenance/wall.ts', 'components/browse/tokens.ts'])).toEqual(['components/browse/tokens.ts']);
    expect(outOfScope(['middleware.wall.ts', 'netlify.toml'])).toEqual(['netlify.toml']);
    expect(outOfScope(['app/globals.css', 'package-lock.json', 'tests/polish/polishBase.ts', 'domain/maintenancex.ts'])).toEqual([
      'app/globals.css',
      'package-lock.json',
      'tests/polish/polishBase.ts',
      'domain/maintenancex.ts',
    ]);
    expect(outOfScope(['tests/maintenance/scope.test.ts', 'scripts/maintenance/check-wall.mjs', 'docs/rent/MAINTENANCE_WALL.md'])).toEqual([]);

    const ref = process.env.MP37_BASE_REF;
    if (ref) {
      const changed = execFileSync('git', ['diff', '--name-only', `${ref}...HEAD`], { cwd: ROOT, encoding: 'utf8' }).split('\n').filter(Boolean);
      expect(changed.length).toBeGreaterThan(0);
      expect(outOfScope(changed)).toEqual([]);
      console.log(`changed since ${ref}:\n${changed.join('\n')}`);
    }
  });
});
