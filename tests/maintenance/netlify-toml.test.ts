// MP-37 AC15: production can never be walled from netlify.toml. Wherever MAINTENANCE_MODE is set in
// the file, it is set to "on" under the deploy-preview or branch-deploy environment and nowhere
// else. This holds on both branches: the feature branch's file does not name it at all, and the
// maintenance-wall branch adds exactly the two preview blocks. A tiny line reader (no dependency)
// tracks the current [section].
//   MP37_BASE_REF=<ref>  also check that the file's diff against <ref> is empty or exactly the two blocks
import { execFileSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import { ROOT, read } from './helpers';

const ALLOWED_SECTIONS = ['context.deploy-preview.environment', 'context.branch-deploy.environment'];
const WALL_BLOCK = ['[context.deploy-preview.environment]', '  MAINTENANCE_MODE = "on"', '[context.branch-deploy.environment]', '  MAINTENANCE_MODE = "on"'];

function tomlProblems(toml: string): string[] {
  const p: string[] = [];
  let section = '';
  toml.split('\n').forEach((raw, i) => {
    const line = raw.replace(/#.*$/, '').trim();
    const header = line.match(/^\[\[?\s*([^\]]+?)\s*\]\]?$/);
    if (header) { section = header[1].replace(/\s+/g, ''); return; }
    const kv = line.match(/^("?)MAINTENANCE_MODE\1\s*=\s*(.+)$/);
    if (!kv) {
      if (/MAINTENANCE_MODE/.test(line)) p.push(`line ${i + 1}: MAINTENANCE_MODE in an unexpected form`);
      return;
    }
    if (/production/.test(section)) p.push(`line ${i + 1}: MAINTENANCE_MODE under [${section}]`);
    else if (!ALLOWED_SECTIONS.includes(section)) p.push(`line ${i + 1}: MAINTENANCE_MODE under [${section || 'top level'}]`);
    if (kv[2].trim() !== '"on"') p.push(`line ${i + 1}: MAINTENANCE_MODE = ${kv[2].trim()}`);
  });
  return p;
}

describe('MP-37 netlify.toml', () => {
  it('netlify.toml never walls the production context', () => {
    // Planted tomls, each reported.
    expect(tomlProblems('[context.production.environment]\n  MAINTENANCE_MODE = "on"\n')).toEqual(['line 2: MAINTENANCE_MODE under [context.production.environment]']);
    expect(tomlProblems('[context.deploy-preview.environment]\n  MAINTENANCE_MODE = "off"\n')).toEqual(['line 2: MAINTENANCE_MODE = "off"']);
    expect(tomlProblems('[context.staging.environment]\n  MAINTENANCE_MODE = "on"\n')).toEqual(['line 2: MAINTENANCE_MODE under [context.staging.environment]']);
    expect(tomlProblems('[build.environment]\n  MAINTENANCE_MODE = "on"\n')).toEqual(['line 2: MAINTENANCE_MODE under [build.environment]']);
    expect(tomlProblems('MAINTENANCE_MODE = "on"\n')).toEqual(['line 1: MAINTENANCE_MODE under [top level]']);
    expect(tomlProblems('[context.production]\n  environment = { MAINTENANCE_MODE = "on" }\n')).toEqual(['line 2: MAINTENANCE_MODE in an unexpected form']);
    expect(tomlProblems(`[[plugins]]\n  package = "x"\n\n${WALL_BLOCK.join('\n')}\n`)).toEqual([]);

    const toml = read('netlify.toml');
    expect(tomlProblems(toml)).toEqual([]);
    expect(toml).not.toMatch(/\[context\.production/);

    if (process.env.MP37_BASE_REF) {
      const diff = execFileSync('git', ['diff', '-U0', process.env.MP37_BASE_REF, '--', 'netlify.toml'], { cwd: ROOT, encoding: 'utf8' });
      const changed = diff.split('\n').filter((l) => /^[+-]/.test(l) && !/^(\+\+\+|---) /.test(l) && l !== '+');
      const ok = changed.length === 0 || JSON.stringify(changed) === JSON.stringify(WALL_BLOCK.map((l) => `+${l}`));
      expect(ok, `netlify.toml diff against ${process.env.MP37_BASE_REF}: ${JSON.stringify(changed)}`).toBe(true);
      console.log(`netlify.toml diff against ${process.env.MP37_BASE_REF}: ${changed.length ? `${changed.length} added lines (the two preview blocks)` : 'empty'}`);
    }
  });
});
