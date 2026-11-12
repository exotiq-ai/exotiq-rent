// MP-37 AC6, AC13: the route checker against in-process HTTP servers that play a walled site, a
// normal site, a half-walled site and a few trailing-slash variants. The checker runs as a child
// process with ASYNC execFile (a blocking spawn would stall the in-process servers). Every request
// it sends is recorded, so the test also proves it sends nothing that could write.
import { execFile } from 'node:child_process';
import { createServer, type IncomingMessage, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import path from 'node:path';
import { promisify } from 'node:util';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildWallResponse } from '@/domain/maintenance/wall';
import { ROOT, scrubWallEnv } from './helpers';

// The suite must not depend on wall variables exported in the caller's shell.
scrubWallEnv();

const run = promisify(execFile);
const SCRIPT = path.join(ROOT, 'scripts/maintenance/check-wall.mjs');
const IMAGE_PROBE = '/_next/image?url=%2Ficon-192.png&w=640&q=75';

type Seen = { method: string; url: string; host: string; contentType: string; authorization: string; bodyLength: number };
type Handler = (method: string, url: string, headers: IncomingMessage['headers']) => Response;

const servers: Server[] = [];
afterAll(async () => { await Promise.all(servers.map((s) => new Promise((r) => s.close(r)))); });

async function serve(handler: Handler): Promise<{ base: string; log: Seen[] }> {
  const log: Seen[] = [];
  const server = createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => chunks.push(c));
    req.on('end', async () => {
      const method = req.method ?? 'GET';
      const url = req.url ?? '/';
      log.push({
        method,
        url,
        host: req.headers.host ?? '',
        contentType: String(req.headers['content-type'] ?? ''),
        authorization: String(req.headers.authorization ?? ''),
        bodyLength: Buffer.concat(chunks).length,
      });
      const r = handler(method, url, req.headers);
      const headers: Record<string, string> = {};
      r.headers.forEach((v, k) => { headers[k] = v; });
      res.writeHead(r.status, headers);
      res.end(method === 'HEAD' ? undefined : Buffer.from(await r.arrayBuffer()));
    });
  });
  servers.push(server);
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', () => r()));
  return { base: `http://127.0.0.1:${(server.address() as AddressInfo).port}`, log };
}

const html = (status: number, text: string) =>
  new Response(`<!doctype html><html><body><p>${text}</p></body></html>`, { status, headers: { 'content-type': 'text/html; charset=utf-8' } });

const PAGES = ['/', '/exotiq', '/exotiq/2017-audi-s8', '/exotiq/2017-audi-s8/book', '/browse', '/privacy', '/terms', '/renters/confirmed', '/robots.txt', '/sitemap.xml', '/manifest.webmanifest'];

/** A walled site: the real wall for everything, the router's 308 for the trailing slash, 400 for images. */
function wallOn(opts: { slash?: (u: string) => Response; except?: (m: string, u: string) => Response | null } = {}): Handler {
  return (method, url, headers) => {
    if (url === '/exotiq/') return opts.slash ? opts.slash(url) : new Response(null, { status: 308, headers: { location: '/exotiq' } });
    if (url.startsWith('/_next/image')) return new Response('"url" parameter is valid but upstream response is invalid', { status: 400 });
    const special = opts.except?.(method, url);
    if (special) return special;
    const h = new Headers();
    for (const [k, v] of Object.entries(headers)) {
      if (typeof v === 'string' && !['host', 'connection', 'content-length', 'transfer-encoding'].includes(k)) h.set(k, v);
    }
    return buildWallResponse(new Request(`http://127.0.0.1${url}`, { method, headers: h }));
  };
}

/** A normal site: pages, a 503 from capture WITHOUT the marker, confirm and unsubscribe redirecting to another host. */
function wallOff(elsewhere: string): Handler {
  return (method, url) => {
    const p = url.split('?')[0];
    if (url === '/exotiq/') return new Response(null, { status: 308, headers: { location: '/exotiq' } });
    if (p === '/') return new Response(null, { status: 307, headers: { location: '/exotiq' } });
    if (p === '/api/renters/capture') return new Response('{"error":"Email sign-up is not available right now."}', { status: 503, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });
    if (p === '/api/renters/confirm' || p === '/api/renters/unsubscribe') return new Response(null, { status: 302, headers: { location: `${elsewhere}/renters/confirmed` } });
    if (p.startsWith('/_next/image')) return new Response('img', { status: 200 });
    if (PAGES.includes(p) || method === 'HEAD') return html(200, 'A normal page');
    return html(404, 'Not found');
  };
}

async function check(base: string, ...args: string[]) {
  try {
    const r = await run(process.execPath, [SCRIPT, base, ...args], { timeout: 60000 });
    return { code: 0, out: r.stdout, err: r.stderr };
  } catch (e) {
    const x = e as { code?: number; stdout?: string; stderr?: string };
    return { code: typeof x.code === 'number' ? x.code : -1, out: x.stdout ?? '', err: x.stderr ?? '' };
  }
}
const lines = (out: string) => out.trim().split('\n').filter(Boolean);
const summary = (out: string) => lines(out).filter((l) => l.startsWith('summary:'));
const LINE = /^(GET|HEAD|POST) \S+(?: \((?:RSC: 1|after \/exotiq\/|x-nextjs-data: 1)\))? -> (?:\d{3}|error) retry-after=\S+ marker=(?:on|-) (OK|FAIL|SEEN)(?: .*)?$/;

let elsewhere: { base: string; log: Seen[] };
beforeAll(async () => {
  elsewhere = await serve(() => new Response('another host', { status: 200 }));
});

describe('MP-37 the route checker', () => {
  it('check-wall passes a wall-on server with --expect on', async () => {
    const site = await serve(wallOn());
    const r = await check(site.base, '--expect', 'on');
    expect(r.code, r.out + r.err).toBe(0);
    const body = lines(r.out).filter((l) => !l.startsWith('summary:'));
    for (const l of body) expect(l, l).toMatch(LINE);
    expect(body.filter((l) => l.endsWith(' FAIL'))).toEqual([]);
    expect(body.find((l) => l.startsWith(`GET ${IMAGE_PROBE} -> 400 `))).toMatch(/ SEEN$/);
    // The trailing-slash probe: one 308 to a same-origin path, then the wall.
    expect(body.some((l) => /^GET \/exotiq\/ -> 308 .* location=\/exotiq$/.test(l))).toBe(true);
    expect(body.some((l) => /^GET \/exotiq \(after \/exotiq\/\) -> 503 retry-after=1800 marker=on OK$/.test(l))).toBe(true);
    expect(summary(r.out)).toEqual([expect.stringMatching(/^summary: expect on: \d+ asserted, all OK$/)]);
    console.log(r.out);
  });

  it('check-wall probes the data-request shape with the fixed build id under --expect on only', async () => {
    const DATA = ['GET /_next/data/maintenance-wall/exotiq.json', 'GET /_next/data/maintenance-wall/api/renters/capture.json', 'POST /_next/data/maintenance-wall/api/renters/capture.json'];
    // A site that walls everything except a request carrying x-nextjs-data (what a host may hand past the middleware).
    const leaky = await serve((m, u, h) => (h['x-nextjs-data'] ? html(200, 'the real page') : wallOn()(m, u, h)));
    const r = await check(leaky.base, '--expect', 'on');
    expect(r.code, r.out).toBe(1);
    expect(lines(r.out).filter((l) => l.endsWith(' FAIL')).map((l) => l.split(' -> ')[0])).toEqual(DATA.map((d) => `${d} (x-nextjs-data: 1)`));
    expect(summary(r.out)[0]).toBe(`summary: expect on: 3 of 30 FAILED: ${DATA.map((d) => `${d} (x-nextjs-data: 1)`).join(', ')}`);
    // The probes send the header and the fixed id; the POST is empty text/plain.
    const sent = leaky.log.filter((x) => x.url.startsWith('/_next/data/'));
    expect(sent.map((x) => `${x.method} ${x.url}`)).toEqual(DATA);
    expect(sent.find((x) => x.method === 'POST')).toMatchObject({ contentType: 'text/plain', bodyLength: 0 });
    // A walled site passes them; under --expect off they are not sent at all.
    const walled = await serve(wallOn());
    expect((await check(walled.base, '--expect', 'on')).code).toBe(0);
    const normal = await serve(wallOff(elsewhere.base));
    await check(normal.base, '--expect', 'off');
    expect(normal.log.filter((x) => x.url.startsWith('/_next/data/'))).toEqual([]);
  });

  it('check-wall passes a wall-off server with --expect off', async () => {
    const site = await serve(wallOff(elsewhere.base));
    const r = await check(site.base, '--expect=off');
    expect(r.code, r.out + r.err).toBe(0);
    // Capture answers 503 without the marker: still a pass, because status is not the signal.
    expect(lines(r.out).find((l) => l.startsWith('POST /api/renters/capture -> 503 '))).toMatch(/marker=- OK$/);
    expect(summary(r.out)).toEqual([expect.stringMatching(/^summary: expect off: \d+ asserted, all OK$/)]);
  });

  it('check-wall names the core pages and fails --expect off for a site whose core pages do not answer', async () => {
    const CORE = ['/', '/terms', '/privacy', '/robots.txt'];
    // Stand-ins for a dead or wrong site: the same answer on every path, never the wall marker.
    const dead: [string, Handler][] = [
      ['404 everywhere', () => html(404, 'Not found')],
      ['401 everywhere', () => new Response('login', { status: 401, headers: { 'www-authenticate': 'Basic' } })],
      ['500 everywhere', () => html(500, 'Error')],
      ['bare 503 everywhere', () => new Response('down', { status: 503, headers: { 'retry-after': '1800' } })],
    ];
    for (const [name, handler] of dead) {
      const site = await serve(handler);
      const r = await check(site.base, '--expect', 'off');
      expect(r.code, name).toBe(1);
      const failed = lines(r.out).filter((l) => l.endsWith('(core page did not answer below 400)'));
      expect(failed.map((l) => l.split(' ')[1]).sort(), name).toEqual(CORE.slice().sort());
      expect(summary(r.out)[0], name).toMatch(/^summary: expect off: 4 of \d+ FAILED: GET \/, GET \/privacy, GET \/terms, GET \/robots\.txt$/);
    }
    // The core set is named in the output; a healthy normal site passes, and its non-core 404s do not count.
    const ok = await check((await serve(wallOff(elsewhere.base))).base, '--expect', 'off');
    expect(ok.code, ok.out).toBe(0);
    expect(lines(ok.out)[0]).toBe('expect off: no route may carry the wall marker or the wall page; the core pages /, /terms, /privacy, /robots.txt must also answer below 400');
    expect(lines(ok.out).find((l) => l.startsWith('GET /definitely-not-a-page -> 404 '))).toMatch(/ OK$/);
    expect(lines(ok.out).find((l) => l.startsWith('GET / -> 307 '))).toMatch(/ OK location=\/exotiq$/);
    // Only one core page down: exactly that one fails.
    const half = await serve((m, u) => (u === '/terms' ? html(404, 'gone') : wallOff(elsewhere.base)(m, u, {})));
    const h = await check(half.base, '--expect', 'off');
    expect(h.code).toBe(1);
    expect(summary(h.out)[0]).toMatch(/: 1 of \d+ FAILED: GET \/terms$/);
  });

  it('check-wall needs all three of 503, Retry-After and the marker for --expect on', async () => {
    const failing = (out: string) => lines(out).filter((l) => / FAIL( |$)/.test(l) && !l.startsWith('summary:'));
    // An ordinary outage or a host error page: 503 and Retry-After everywhere, but no wall marker.
    const outage = await serve(() => new Response('Service Unavailable', { status: 503, headers: { 'retry-after': '120' } }));
    const a = await check(outage.base, '--expect', 'on');
    expect(a.code, a.out).toBe(1);
    expect(failing(a.out).length).toBe(30);
    expect(lines(a.out).find((l) => l.startsWith('GET /privacy -> '))).toBe('GET /privacy -> 503 retry-after=120 marker=- FAIL');
    expect(summary(a.out)[0]).toMatch(/^summary: expect on: 30 of 30 FAILED: /);
    // The same outage under --expect off: no wall marker anywhere, but the four core pages fail.
    const b = await check(outage.base, '--expect', 'off');
    expect(b.code, b.out).toBe(1);
    expect(lines(b.out).filter((l) => / marker=on /.test(l))).toEqual([]);
    expect(failing(b.out).map((l) => l.split(' ')[1]).sort()).toEqual(['/', '/privacy', '/robots.txt', '/terms']);
    expect(summary(b.out)[0]).toMatch(/^summary: expect off: 4 of \d+ FAILED: /);
    // The marker with status 200 is not the wall.
    const ok200 = await serve(() => new Response('ok', { status: 200, headers: { 'x-exotiq-maintenance': 'on', 'retry-after': '1800' } }));
    const c = await check(ok200.base, '--expect', 'on');
    expect(c.code, c.out).toBe(1);
    expect(lines(c.out).find((l) => l.startsWith('GET /privacy -> '))).toBe('GET /privacy -> 200 retry-after=1800 marker=on FAIL');
    expect(summary(c.out)[0]).toMatch(/^summary: expect on: 30 of 30 FAILED: /);
    // 503 and the marker without Retry-After is not the wall either.
    const noRetry = await serve(() => new Response('x', { status: 503, headers: { 'x-exotiq-maintenance': 'on' } }));
    const d = await check(noRetry.base, '--expect', 'on');
    expect(d.code, d.out).toBe(1);
    expect(lines(d.out).find((l) => l.startsWith('GET /privacy -> '))).toBe('GET /privacy -> 503 retry-after=- marker=on FAIL');
    expect(summary(d.out)[0]).toMatch(/^summary: expect on: 30 of 30 FAILED: /);
  });

  it('check-wall fails a wall-off server with --expect on and a wall-on server with --expect off', async () => {
    const off = await serve(wallOff(elsewhere.base));
    const on = await serve(wallOn());
    const a = await check(off.base, '--expect', 'on');
    const b = await check(on.base, '--expect', 'off');
    expect(a.code).toBe(1);
    expect(b.code).toBe(1);
    expect(summary(a.out)[0]).toMatch(/^summary: expect on: \d+ of \d+ FAILED: /);
    expect(summary(b.out)[0]).toMatch(/^summary: expect off: \d+ of \d+ FAILED: /);
  });

  it('check-wall names every failing route and exits non-zero on a half-walled server', async () => {
    const half = await serve(wallOn({ except: (m, u) => (m === 'POST' && u === '/api/renters/capture' ? new Response('{}', { status: 200 }) : null) }));
    const r = await check(half.base, '--expect', 'on');
    expect(r.code).toBe(1);
    expect(lines(r.out).filter((l) => l.endsWith(' FAIL'))).toEqual(['POST /api/renters/capture -> 200 retry-after=- marker=- FAIL']);
    expect(summary(r.out)).toEqual([expect.stringMatching(/^summary: expect on: 1 of \d+ FAILED: POST \/api\/renters\/capture$/)]);

    // A trailing-slash redirect to another host fails and that host is never asked.
    const before = elsewhere.log.length;
    const away = await serve(wallOn({ slash: () => new Response(null, { status: 308, headers: { location: `${elsewhere.base}/exotiq` } }) }));
    const a = await check(away.base, '--expect', 'on');
    expect(a.code).toBe(1);
    expect(summary(a.out)[0]).toMatch(/FAILED: GET \/exotiq\/$/);
    expect(elsewhere.log.length).toBe(before);

    // A trailing-slash redirect whose second answer is not the wall fails.
    const plain = await serve(wallOn({
      slash: () => new Response(null, { status: 308, headers: { location: '/exotiq-plain' } }),
      except: (_m, u) => (u === '/exotiq-plain' ? html(200, 'not the wall') : null),
    }));
    const b = await check(plain.base, '--expect', 'on');
    expect(b.code).toBe(1);
    expect(summary(b.out)[0]).toMatch(/FAILED: GET \/exotiq\/$/);

    // An unparsable Location is a FAIL line, not a crash.
    const broken = await serve(wallOn({ slash: () => new Response(null, { status: 308, headers: { location: 'http://[bad' } }) }));
    const c = await check(broken.base, '--expect', 'on');
    expect(c.code).toBe(1);
    expect(c.err).not.toMatch(/TypeError|at main/);
    expect(summary(c.out)[0]).toMatch(/FAILED: GET \/exotiq\/$/);

    // A trailing-slash shape that is walled at once (no redirect) passes.
    const direct = await serve(wallOn({ slash: (u) => buildWallResponse(new Request(`http://127.0.0.1${u}`)) }));
    expect((await check(direct.base, '--expect', 'on')).code).toBe(0);
  });

  it('check-wall sends only requests that cannot write', async () => {
    const before = elsewhere.log.length;
    for (const [handler, mode] of [[wallOn(), 'on'], [wallOff(elsewhere.base), 'off']] as const) {
      const site = await serve(handler);
      await check(site.base, '--expect', mode);
      const host = new URL(site.base).host;
      expect(site.log.length, mode).toBeGreaterThan(20);
      expect(Array.from(new Set(site.log.map((s) => s.method))).sort(), mode).toEqual(['GET', 'HEAD', 'POST']);
      const posts = site.log.filter((s) => s.method === 'POST');
      const postUrls = mode === 'on' ? ['/api/renters/capture', '/_next/data/maintenance-wall/api/renters/capture.json'] : ['/api/renters/capture'];
      expect(posts, mode).toEqual(postUrls.map((url) => ({ method: 'POST', url, host, contentType: 'text/plain', authorization: '', bodyLength: 0 })));
      for (const s of site.log) {
        expect(s.host, s.url).toBe(host);
        expect(s.authorization, s.url).toBe('');
        expect(s.url, s.url).not.toMatch(/token|key=|secret/i);
        if (s.method !== 'POST') expect(s.bodyLength, s.url).toBe(0);
      }
    }
    // The cross-origin Location from confirm and unsubscribe was recorded, never followed.
    expect(elsewhere.log.length).toBe(before);
  });

  it('check-wall refuses a missing --expect and a non-http base url', async () => {
    const site = await serve(wallOn());
    for (const args of [[site.base], [site.base, '--expect'], [site.base, '--expect', 'maybe'], ['ftp://127.0.0.1/', '--expect', 'on'], ['file:///etc/hosts', '--expect', 'on'], ['--expect', 'on'], ['not a url', '--expect', 'on']]) {
      let code = 0;
      let text = '';
      try {
        await run(process.execPath, [SCRIPT, ...args]);
      } catch (e) {
        const x = e as { code?: number; stdout?: string; stderr?: string };
        code = typeof x.code === 'number' ? x.code : -1;
        text = `${x.stdout ?? ''}${x.stderr ?? ''}`;
      }
      expect(code, JSON.stringify(args)).toBe(2);
      expect(text, JSON.stringify(args)).toMatch(/usage: node scripts\/maintenance\/check-wall\.mjs <base-url> --expect on\|off/);
    }
    expect(site.log).toEqual([]);
  });
});
