// MP-37 AC1: the wall variable is on only for on, true or 1 (any case, trimmed). Everything else,
// including near misses like yes and onn, is off. The checker is first run on a planted parser.
import { createRequire } from 'node:module';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { OFF_VALUES, ON_VALUES, ROOT } from './helpers';

const require = createRequire(import.meta.url);
const flags = () => require(path.join(ROOT, 'domain/maintenance/flags.js')) as { isWallOn: (v: unknown) => boolean };

/** Each value the parser reads the wrong way, labelled. */
function parserProblems(isOn: (v: string | undefined) => boolean): string[] {
  return [
    ...ON_VALUES.filter((v) => isOn(v) !== true).map((v) => `${JSON.stringify(v)} reads as off`),
    ...OFF_VALUES.filter((v) => isOn(v) !== false).map((v) => `${JSON.stringify(v) ?? 'unset'} reads as on`),
  ];
}

describe('MP-37 the wall variable', () => {
  it('flag parsing: on, true and 1 in any case with spaces are on and everything else is off', () => {
    // The test cannot pass by checking nothing: a loose parser is reported value by value.
    const loose = (v: string | undefined) => ['on', 'true', '1', 'yes', 'onn', '0', ''].includes((v ?? 'x').trim().toLowerCase());
    expect(parserProblems(loose)).toEqual(['"" reads as on', '"0" reads as on', '"yes" reads as on', '"onn" reads as on']);
    expect(parserProblems(flags().isWallOn)).toEqual([]);
  });
});
