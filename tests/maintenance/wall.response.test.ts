// MP-37 AC4: every method against every path class answers 503 with the five wall headers, no
// Set-Cookie and no Location; HEAD carries no body; and the middleware source never hands the
// request on (no next, rewrite or redirect) and exports no matcher, so it matches every path.
import { describe, expect, it } from 'vitest';
import { buildWallResponse } from '@/domain/maintenance/wall';
import { middleware } from '@/middleware.wall';
import { stripComments } from '../design/lib/scan.mjs';
import { exists, makeRequest, matrix, METHODS, read, scrubWallEnv, WALL_JSON, wallHeaderProblems, withoutHeader } from './helpers';

// The suite must not depend on wall variables exported in the caller's shell.
scrubWallEnv();

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

  it('the middleware file itself answers the wall for every method and path class', async () => {
    // Problems for a middleware function run over the whole matrix. In Next a middleware that
    // returns nothing lets the request through, so "no Response" is a failure too.
    const run = async (fn: (r: Request) => unknown) => {
      const p: string[] = [];
      for (const c of matrix()) {
        const res = await fn(makeRequest(c.method, c.path, c.headers));
        const label = `${c.method} ${c.label}`;
        if (!(res instanceof Response)) { p.push(`${label}: no response (passes through)`); continue; }
        p.push(...wallHeaderProblems(label, res));
        if (c.method === 'HEAD' && res.body !== null) p.push(`${label}: HEAD has a body`);
      }
      return p;
    };
    // Planted: a middleware that walls GET only lets every other method through, and is caught.
    const getOnly = (r: Request) => (r.method === 'GET' ? middleware(r) : undefined);
    const planted = await run(getOnly);
    expect(planted.length).toBe(matrix().length - matrix().filter((c) => c.method === 'GET').length);
    expect(planted[0]).toMatch(/no response \(passes through\)$/);
    expect(await run(middleware)).toEqual([]);
    // A page, an API path and a HEAD, spelled out.
    const page = middleware(new Request('https://book.example.test/exotiq/2017-audi-s8/book'));
    expect(wallHeaderProblems('page', page)).toEqual([]);
    expect(page.headers.get('content-type')).toBe('text/html; charset=utf-8');
    const api = middleware(new Request('https://book.example.test/api/renters/capture', { method: 'POST', body: '{}' }));
    expect(wallHeaderProblems('api', api)).toEqual([]);
    expect(await api.text()).toBe(WALL_JSON);
    const head = middleware(new Request('https://book.example.test/exotiq', { method: 'HEAD' }));
    expect(wallHeaderProblems('head', head)).toEqual([]);
    expect(head.body).toBeNull();
  });

  it('the origin catch-all answers the wall for every method and path class', async () => {
    // The second layer: in a wall build app/[[...wall]]/route.wall.ts is the only route, so a
    // request that a host hands past the middleware still gets the wall from the app itself.
    const route = (await import('@/app/[[...wall]]/route.wall')) as unknown as Record<string, unknown>;
    expect(route.dynamic).toBe('force-dynamic');
    const missing = METHODS.filter((m) => typeof route[m] !== 'function');
    expect(missing).toEqual([]);
    const p: string[] = [];
    for (const c of matrix()) {
      const res = await (route[c.method] as (r: Request) => unknown)(makeRequest(c.method, c.path, c.headers));
      const label = `${c.method} ${c.label}`;
      if (!(res instanceof Response)) { p.push(`${label}: no response`); continue; }
      p.push(...wallHeaderProblems(label, res));
      if (c.method === 'HEAD' && res.body !== null) p.push(`${label}: HEAD has a body`);
    }
    expect(p).toEqual([]);
    // The data-request shape a host may hand to the origin gets the wall too.
    const data = await (route.GET as (r: Request) => Response)(makeRequest('GET', '/_next/data/maintenance-wall/exotiq.json', { 'x-nextjs-data': '1' }));
    expect(wallHeaderProblems('data request', data)).toEqual([]);
    const source = read('app/[[...wall]]/route.wall.ts');
    expect(sourceProblems('app/[[...wall]]/route.wall.ts', source, false)).toEqual([]);
    expect(stripComments(source)).not.toMatch(/MAINTENANCE_/);
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
