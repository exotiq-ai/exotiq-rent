// MP-18 AC13(a): no dependency is added. The expected manifest is the branch base's (a73d09b)
// package.json, pasted here; the checker is pure and fixture-tested so it can be seen to fail.
// The other AC13 proofs are runs of existing guards plus diffs (evidence files).
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));

type Deps = { dependencies?: Record<string, string>; devDependencies?: Record<string, string> };

/** package.json at a73d09b. */
export const BASE_DEPS: Required<Deps> = {
  dependencies: {
    '@stripe/stripe-js': '^9.12.0',
    'lucide-react': '^0.563.0',
    next: '^14.2.0',
    'posthog-js': '1.433.10',
    react: '^18.3.0',
    'react-dom': '^18.3.0',
  },
  devDependencies: {
    '@types/node': '^20',
    '@types/react': '^18',
    '@types/react-dom': '^18',
    autoprefixer: '^10.4.0',
    eslint: '^8',
    'eslint-config-next': '^14.2.0',
    postcss: '^8',
    tailwindcss: '^3.4.0',
    typescript: '^5',
    vitest: '^4.1.6',
  },
};

/** Every added, removed or re-versioned dependency, named. */
export function dependencyProblems(pkg: Deps, expected: Required<Deps> = BASE_DEPS): string[] {
  const problems: string[] = [];
  for (const group of ['dependencies', 'devDependencies'] as const) {
    const have = pkg[group] ?? {};
    const want = expected[group];
    for (const [name, version] of Object.entries(have)) {
      if (!(name in want)) problems.push(`${group}: ${name} added`);
      else if (want[name] !== version) problems.push(`${group}: ${name} ${want[name]} -> ${version}`);
    }
    for (const name of Object.keys(want)) if (!(name in have)) problems.push(`${group}: ${name} removed`);
  }
  return problems;
}

describe('MP-18 restraint (AC13)', () => {
  it('package manifest adds no dependency', () => {
    expect(dependencyProblems(BASE_DEPS)).toEqual([]);
    expect(dependencyProblems({ ...BASE_DEPS, devDependencies: { ...BASE_DEPS.devDependencies, jsdom: '^25' } })).toEqual(['devDependencies: jsdom added']);
    expect(dependencyProblems({ ...BASE_DEPS, dependencies: { ...BASE_DEPS.dependencies, 'posthog-js': '1.500.0' } })).toEqual(['dependencies: posthog-js 1.433.10 -> 1.500.0']);
    expect(dependencyProblems({ ...BASE_DEPS, dependencies: { ...BASE_DEPS.dependencies, sharp: '^0.33' } })).toEqual(['dependencies: sharp added']);

    const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')) as Deps;
    // Foundation adds pinned JOSE verification and the DOM test runtime.
    // Arbitrary additions/version drift still fail the pure controls above.
    expect(dependencyProblems(pkg, { ...BASE_DEPS, dependencies: { ...BASE_DEPS.dependencies, jose: '6.2.3' }, devDependencies: { ...BASE_DEPS.devDependencies, jsdom: '26.1.0', '@types/jsdom': '21.1.7' } })).toEqual([]);
  });
});
