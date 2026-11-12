// MP-37 AC4: every method against every path class answers 503 with the five wall headers, no
// Set-Cookie and no Location; HEAD carries no body; and the middleware source never hands the
// request on (no next, rewrite or redirect) and exports no matcher, so it matches every path.
import { describe, expect, it } from 'vitest';
import { buildWallResponse } from '@/domain/maintenance/wall';
import { stripComments } from '../design/lib/scan.mjs';
import { exists, makeRequest, matrix, read, wallHeaderProblems, withoutHeader } from './helpers';

const HEADERS = ['retry-after', 'cache-control', 'x-robots-tag', 'x-exotiq-maintenance', 'content-security-policy'];

/** Forbidden shapes in a comment-stripped source; `isMiddleware` adds the matcher rules. */
function sourceProblems(name: string, source: string, isMiddleware: boolean): string[] {
  const code = stripComments(source);
  const p: string[] = [];
  for (const needle of ['.next(', 'NextResponse.next', 'rewrite(', 'redirect(']) if (code.includes(needle)) p.push(`${name}: ${needle}`);
  if (isMiddleware) {
    if (/export\s+(const|let|var|function)\s+config\b|export\s*\{[^}]*\bconfig\b/.test(code)) p.push(`${name}: exports config`);
    if (/\bmatcher\b/.test(code)) p.push(`${name}: matcher`);
  }
  return p;
}

describe('MP-37 the wall response', () => {
  it('every method and path class answers 503 with the five wall headers', () => {
    // Planted: a response missing each one wall header in turn is reported by that header's name.
    const good = buildWallResponse(makeRequest('GET', '/'));
    expect(wallHeaderProblems('good', good)).toEqual([]);
    for (const h of HEADERS) expect(wallHeaderProblems('planted', withoutHeader(good, h))).toEqual([`planted: missing ${h}`]);
    const withCookie = new Response(null, { status: 503, headers: { ...Object.fromEntries(good.headers), 'set-cookie': 'a=b', location: '/x' } });
    expect(wallHeaderProblems('planted', withCookie)).toEqual(['planted: has set-cookie', 'planted: has location']);

    const cells = matrix();
    const problems = cells.flatMap((c) => wallHeaderProblems(`${c.method} ${c.label}`, buildWallResponse(makeRequest(c.method, c.path, c.headers))));
    expect(problems).toEqual([]);
    console.log(`wall response matrix: ${cells.length} cells (${new Set(cells.map((c) => c.method)).size} methods x ${new Set(cells.map((c) => c.label)).size} path classes), 0 problems`);
  });

  it('HEAD answers the headers without a body', async () => {
    for (const c of matrix().filter((m) => m.method === 'HEAD')) {
      const res = buildWallResponse(makeRequest('HEAD', c.path, c.headers));
      expect(wallHeaderProblems(c.label, res)).toEqual([]);
      expect(res.body, c.label).toBeNull();
      expect(await res.text(), c.label).toBe('');
    }
  });

  it('the middleware never calls next and exports no matcher', () => {
    // Planted sources: each forbidden shape is reported by name.
    expect(sourceProblems('planted', 'export function middleware() { return NextResponse.next(); }', true)).toEqual(['planted: .next(', 'planted: NextResponse.next']);
    expect(sourceProblems('planted', "export const config = { matcher: ['/((?!api).*)'] };", true)).toEqual(['planted: exports config', 'planted: matcher']);
    expect(sourceProblems('planted', "return NextResponse.redirect(new URL('/x', req.url));", false)).toEqual(['planted: redirect(']);
    expect(sourceProblems('planted', '// NextResponse.next() is never called here\nexport function middleware() {}', true)).toEqual([]);

    expect(exists('middleware.wall.ts')).toBe(true);
    expect(sourceProblems('middleware.wall.ts', read('middleware.wall.ts'), true)).toEqual([]);
    expect(sourceProblems('domain/maintenance/wall.ts', read('domain/maintenance/wall.ts'), false)).toEqual([]);
    expect(stripComments(read('middleware.wall.ts'))).toMatch(/export function middleware\(/);
  });
});
