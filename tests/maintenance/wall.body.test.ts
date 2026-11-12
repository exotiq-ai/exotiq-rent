// MP-37 AC5 with the driver's ruling: an API path gets the exact JSON body unless the caller asks
// for HTML (a link clicked in an e-mail does), every other path gets the HTML document, status and
// headers never change with the body, the request body is never read, and nothing from the
// request (path, query, headers) is reflected into either body.
import { describe, expect, it } from 'vitest';
import { buildWallResponse } from '@/domain/maintenance/wall';
import { makeRequest, METHODS, ORIGIN, PATH_CLASSES, scrubWallEnv, WALL_JSON, wallHeaderProblems } from './helpers';

// The suite must not depend on wall variables exported in the caller's shell.
scrubWallEnv();

const BROWSER_ACCEPT = 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8';
const isApi = (p: string) => p === '/api' || p.startsWith('/api/');

/** A request whose body readers fail the test if anything calls them. */
function guardedRequest(method: string, p: string, headers: Record<string, string> = {}) {
  const req = makeRequest(method, p, headers);
  const calls: string[] = [];
  for (const m of ['text', 'json', 'formData', 'arrayBuffer', 'blob'] as const) {
    Object.defineProperty(req, m, { value: () => { calls.push(m); throw new Error(`request.${m}() was called`); } });
  }
  return { req, calls };
}

/** Marker strings planted in the request must never appear in the response body. */
async function reflectionProblems(build: (r: Request) => Response): Promise<string[]> {
  const p: string[] = [];
  const probes = [
    { path: '/exotiq/<script>alert(1)</script>', needles: ['<script>alert(1)</script>', 'alert(1)', '%3Cscript%3E'] },
    { path: '/exotiq?x="><img src=x>', needles: ['<img src=x>', '"><img', '%22%3E%3Cimg'] },
    { path: '/api/renters/capture?x="><img src=x>', needles: ['<img src=x>', '%22%3E%3Cimg'] },
  ];
  const odd = { 'X-Planted-Header': 'planted-header-value-zz', 'User-Agent': 'planted-agent-zz', Referer: 'https://planted-referer.example/zz' };
  for (const probe of probes) {
    for (const accept of [BROWSER_ACCEPT, '*/*']) {
      const res = build(new Request(ORIGIN + probe.path, { headers: { ...odd, Accept: accept } }));
      const body = await res.text();
      for (const n of [...probe.needles, 'planted-header-value-zz', 'planted-agent-zz', 'planted-referer', 'book.example.test']) {
        if (body.includes(n)) p.push(`${probe.path} (${accept}): body reflects ${n}`);
      }
    }
  }
  return p;
}

describe('MP-37 the wall body', () => {
  it('api paths get the exact JSON body and other paths get the HTML document', async () => {
    for (const method of METHODS) {
      for (const pc of PATH_CLASSES) {
        const { req, calls } = guardedRequest(method, pc.path, pc.headers);
        const res = buildWallResponse(req);
        const label = `${method} ${pc.path}`;
        const body = await res.text();
        if (isApi(pc.path)) {
          expect(res.headers.get('content-type'), label).toBe('application/json');
          expect(body, label).toBe(method === 'HEAD' ? '' : WALL_JSON);
        } else {
          expect(res.headers.get('content-type'), label).toBe('text/html; charset=utf-8');
          if (method === 'HEAD') expect(body, label).toBe('');
          else {
            expect(body.match(/<html[\s>]/g)?.length, label).toBe(1);
            expect(body.trimStart().toLowerCase().startsWith('<!doctype html>'), label).toBe(true);
          }
        }
        expect(calls, label).toEqual([]);
        expect(req.bodyUsed, label).toBe(false);
      }
    }
  });

  it('html navigations on api paths get the page and other api calls get json', async () => {
    const api = ['/api/renters/confirm', '/api/renters/unsubscribe', '/api/renters/capture'];
    for (const p of api) {
      const html = buildWallResponse(makeRequest('GET', p, { Accept: BROWSER_ACCEPT }));
      expect(html.headers.get('content-type'), p).toBe('text/html; charset=utf-8');
      expect(await html.text(), p).toContain('<h1>');
      for (const accept of ['*/*', 'application/json', undefined]) {
        const res = buildWallResponse(makeRequest('GET', p, accept ? { Accept: accept } : {}));
        expect(res.headers.get('content-type'), `${p} ${accept}`).toBe('application/json');
        expect(await res.text()).toBe(WALL_JSON);
        // Status and headers are the same either way.
        expect(wallHeaderProblems(`${p} json`, res)).toEqual([]);
      }
      expect(wallHeaderProblems(`${p} html`, html)).toEqual([]);
      const head = buildWallResponse(makeRequest('HEAD', p, { Accept: BROWSER_ACCEPT }));
      expect(await head.text()).toBe('');
    }
    // Pages always get the document, whatever the caller accepts.
    for (const accept of ['application/json', '*/*']) {
      expect(buildWallResponse(makeRequest('GET', '/exotiq', { Accept: accept })).headers.get('content-type')).toBe('text/html; charset=utf-8');
    }
  });

  it('the request path, query and headers are never reflected', async () => {
    // Planted renderers that echo the URL or a header are caught.
    expect((await reflectionProblems((r) => new Response(`<p>${r.url}</p>`))).length).toBeGreaterThan(0);
    expect((await reflectionProblems((r) => new Response(`<p>${r.headers.get('x-planted-header')}</p>`))).length).toBeGreaterThan(0);
    expect(await reflectionProblems((r) => buildWallResponse(r))).toEqual([]);
  });
});
