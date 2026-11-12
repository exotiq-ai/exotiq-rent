#!/usr/bin/env node
// Maintenance wall route checker (MP-37).
//
//   node scripts/maintenance/check-wall.mjs <base-url> --expect on|off
//
// Requests a fixed list of routes on <base-url> and prints one line per request:
//   <METHOD> <path> -> <status> retry-after=<value|-> marker=<on|-> OK|FAIL|SEEN
// --expect on:  every asserted route must answer 503 with Retry-After and X-Exotiq-Maintenance: on.
// --expect off: no asserted route may carry X-Exotiq-Maintenance or the wall page. Status is not
//               used, because a normal site can answer 503 for its own reasons.
// Exit 0 when every asserted route passes, 1 otherwise (the last line names the failures), 2 for a
// usage error.
//
// It only sends requests that cannot write: GET and HEAD, plus one POST to the e-mail capture
// route with an empty text/plain body (refused before anything is read). It sends no token, talks
// to <base-url>'s host only, and follows at most one redirect, only for the trailing-slash probe
// and only to a path on the same origin. A Location naming another host is printed, never fetched.

const USAGE = 'usage: node scripts/maintenance/check-wall.mjs <base-url> --expect on|off';
const TIMEOUT_MS = 10000;
const WALL_TEXT = 'Booking is paused for maintenance';

function usage() {
  console.error(USAGE);
  process.exit(2);
}

function parseArgs(argv) {
  let base = '';
  let expect = '';
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--expect') {
      expect = argv[i + 1] ?? '';
      i++;
    } else if (a.startsWith('--expect=')) expect = a.slice('--expect='.length);
    else if (!a.startsWith('--') && !base) base = a;
    else usage();
  }
  if (!base || (expect !== 'on' && expect !== 'off')) usage();
  let url;
  try {
    url = new URL(base);
  } catch {
    usage();
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') usage();
  return { origin: url.origin, expect };
}

const GET_PATHS = [
  '/',
  '/exotiq',
  '/exotiq/2017-audi-s8',
  '/exotiq/2017-audi-s8/book',
  '/browse',
  '/privacy',
  '/terms',
  '/renters/confirmed',
  '/booking/does-not-exist',
  '/api/renters/capture',
  '/api/renters/confirm',
  '/api/renters/unsubscribe',
  '/robots.txt',
  '/sitemap.xml',
  '/manifest.webmanifest',
  '/icon.svg',
  '/apple-icon.png',
  '/favicon.ico',
  '/opengraph-image',
  '/_next/static/chunks/main.js',
  '/fonts/dfaalt/Dfaalt-Bold.woff',
  '/images/logos/drive-exotiq-emblem-white.svg',
  '/definitely-not-a-page',
];

/** The asserted routes, in order. */
const ROUTES = [
  ...GET_PATHS.map((path) => ({ method: 'GET', path, label: path })),
  { method: 'GET', path: '/exotiq', label: '/exotiq (RSC: 1)', headers: { RSC: '1' } },
  { method: 'HEAD', path: '/exotiq', label: '/exotiq' },
  { method: 'POST', path: '/api/renters/capture', label: '/api/renters/capture', headers: { 'Content-Type': 'text/plain' }, body: '' },
];
const SLASH_PROBE = '/exotiq/';
const IMAGE_PROBE = '/_next/image?url=%2Ficon-192.png&w=640&q=75';

async function send(origin, { method, path, headers = {}, body }) {
  try {
    const res = await fetch(origin + path, { method, headers, body, redirect: 'manual', signal: AbortSignal.timeout(TIMEOUT_MS) });
    const text = method === 'HEAD' ? '' : await res.text();
    return {
      status: String(res.status),
      code: res.status,
      retryAfter: res.headers.get('retry-after'),
      marker: res.headers.get('x-exotiq-maintenance'),
      location: res.headers.get('location'),
      text,
      error: '',
    };
  } catch (e) {
    return { status: 'error', code: 0, retryAfter: null, marker: null, location: null, text: '', error: e instanceof Error ? e.message : String(e) };
  }
}

const isWall = (r) => r.code === 503 && r.retryAfter !== null && r.marker === 'on';
const isNormal = (r) => !r.error && r.marker === null && !r.text.includes(WALL_TEXT);

function line(method, label, r, verdict) {
  let s = `${method} ${label} -> ${r.status} retry-after=${r.retryAfter ?? '-'} marker=${r.marker === 'on' ? 'on' : '-'} ${verdict}`;
  if (r.location) s += ` location=${r.location}`;
  if (r.error) s += ` (${r.error})`;
  console.log(s);
}

async function main() {
  const { origin, expect } = parseArgs(process.argv.slice(2));
  const pass = expect === 'on' ? isWall : isNormal;
  const failed = [];
  let asserted = 0;

  for (const route of ROUTES) {
    const r = await send(origin, route);
    asserted++;
    const ok = pass(r);
    if (!ok) failed.push(`${route.method} ${route.label}`);
    line(route.method, route.label, r, ok ? 'OK' : 'FAIL');
  }

  // Trailing slash: the router's normalising redirect runs before any middleware. Under --expect on
  // the shape passes when it is walled at once, or when one redirect to a same-origin path lands on
  // the wall. Under --expect off it is only shown.
  const first = await send(origin, { method: 'GET', path: SLASH_PROBE });
  if (expect === 'off') line('GET', SLASH_PROBE, first, 'SEEN');
  else {
    asserted++;
    if (isWall(first)) line('GET', SLASH_PROBE, first, 'OK');
    else if (first.code >= 300 && first.code < 400 && first.location) {
      const target = new URL(first.location, origin);
      if (target.origin !== origin) {
        line('GET', SLASH_PROBE, { ...first, error: 'redirect to another host, not followed' }, 'FAIL');
        failed.push(`GET ${SLASH_PROBE}`);
      } else {
        line('GET', SLASH_PROBE, first, 'SEEN');
        const next = target.pathname + target.search;
        const second = await send(origin, { method: 'GET', path: next });
        const ok = isWall(second);
        if (!ok) failed.push(`GET ${SLASH_PROBE}`);
        line('GET', `${next} (after ${SLASH_PROBE})`, second, ok ? 'OK' : 'FAIL');
      }
    } else {
      line('GET', SLASH_PROBE, first, 'FAIL');
      failed.push(`GET ${SLASH_PROBE}`);
    }
  }

  // The image optimizer is shown with whatever it answers and never decides the result.
  line('GET', IMAGE_PROBE, await send(origin, { method: 'GET', path: IMAGE_PROBE }), 'SEEN');

  if (failed.length === 0) console.log(`summary: expect ${expect}: ${asserted} asserted, all OK`);
  else console.log(`summary: expect ${expect}: ${failed.length} of ${asserted} FAILED: ${failed.join(', ')}`);
  process.exit(failed.length === 0 ? 0 : 1);
}

main();
