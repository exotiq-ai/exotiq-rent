// MP-37 shared helpers for the maintenance wall tests: the repo root, file walking, the request
// matrix, header and body checks, and the visible-text reader. Test-only code; nothing here is
// imported by the app.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = fileURLToPath(new URL('../../', import.meta.url));
export const read = (rel: string) => readFileSync(path.join(ROOT, rel), 'utf8');
export const exists = (rel: string) => existsSync(path.join(ROOT, rel));

/** AC1 definitions: on is on, true or 1 trimmed and any case; everything else is off. */
export const ON_VALUES = ['on', 'ON', 'true', 'TRUE', '1', ' on '];
export const OFF_VALUES: (string | undefined)[] = [undefined, '', 'off', 'false', '0', 'yes', 'onn'];

export const METHODS =['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'];

/** Every path class in AC4. `headers` adds request headers (the RSC case). */
export const PATH_CLASSES: { label: string; path: string; headers?: Record<string, string> }[] = [
  { label: 'page /', path: '/' },
  { label: 'page /exotiq', path: '/exotiq' },
  { label: 'deep link vehicle', path: '/exotiq/2017-audi-s8' },
  { label: 'deep link book', path: '/exotiq/2017-audi-s8/book' },
  { label: 'api capture', path: '/api/renters/capture' },
  { label: 'api confirm', path: '/api/renters/confirm' },
  { label: 'api unsubscribe', path: '/api/renters/unsubscribe' },
  { label: 'robots', path: '/robots.txt' },
  { label: 'sitemap', path: '/sitemap.xml' },
  { label: 'manifest', path: '/manifest.webmanifest' },
  { label: 'icon svg', path: '/icon.svg' },
  { label: 'apple icon', path: '/apple-icon.png' },
  { label: 'favicon', path: '/favicon.ico' },
  { label: 'og image', path: '/opengraph-image' },
  { label: 'static asset', path: '/_next/static/chunks/x.js' },
  { label: 'next data', path: '/_next/data/x/exotiq.json' },
  { label: 'public file', path: '/fonts/dfaalt/Dfaalt-Bold.woff' },
  { label: 'unknown path', path: '/definitely-not-a-page' },
  { label: 'rsc header', path: '/exotiq', headers: { RSC: '1' } },
  { label: 'rsc query', path: '/exotiq?_rsc=abc123' },
];

export const ORIGIN = 'https://book.example.test';

export function makeRequest(method: string, p: string, headers: Record<string, string> = {}): Request {
  const init: RequestInit = { method, headers };
  if (!['GET', 'HEAD'].includes(method)) init.body = 'planted-request-body';
  return new Request(ORIGIN + p, init);
}

/** Every (method, path class) pair. */
export function matrix() {
  return METHODS.flatMap((method) => PATH_CLASSES.map((pc) => ({ method, ...pc })));
}

export const WALL_CSP = "default-src 'none'; style-src 'unsafe-inline'; img-src data:; frame-ancestors 'none'";
export const WALL_JSON = '{"error":"Booking is paused for maintenance. Please try again later.","maintenance":true}';

/** The five wall headers, the status, and no Set-Cookie or Location. Returns labelled problems. */
export function wallHeaderProblems(label: string, res: Response, retryAfter = '1800'): string[] {
  const p: string[] = [];
  if (res.status !== 503) p.push(`${label}: status ${res.status}`);
  const want: [string, string][] = [
    ['retry-after', retryAfter],
    ['cache-control', 'no-store'],
    ['x-robots-tag', 'noindex'],
    ['x-exotiq-maintenance', 'on'],
    ['content-security-policy', WALL_CSP],
  ];
  for (const [name, value] of want) {
    const got = res.headers.get(name);
    if (got === null) p.push(`${label}: missing ${name}`);
    else if (got !== value) p.push(`${label}: ${name} is ${JSON.stringify(got)}`);
  }
  if (res.headers.get('set-cookie') !== null) p.push(`${label}: has set-cookie`);
  if (res.headers.get('location') !== null) p.push(`${label}: has location`);
  return p;
}

/** A copy of `res` with one header removed (for planted faults). */
export function withoutHeader(res: Response, name: string): Response {
  const h = new Headers(res.headers);
  h.delete(name);
  return new Response(null, { status: res.status, headers: h });
}

/** Text files under `dirs` (repo-relative), skipping node_modules and .next. */
export function walkText(dirs: string[], exts = /\.(tsx?|mts|cts|mjs|cjs|jsx?|json|md|html|css|txt|toml|ya?ml)$/): string[] {
  const out: string[] = [];
  const walk = (rel: string) => {
    const abs = path.join(ROOT, rel);
    if (!existsSync(abs)) return;
    if (statSync(abs).isFile()) {
      if (exts.test(rel)) out.push(rel);
      return;
    }
    for (const e of readdirSync(abs, { withFileTypes: true })) {
      if (e.name === 'node_modules' || e.name === '.next') continue;
      walk(rel ? `${rel}/${e.name}` : e.name);
    }
  };
  for (const d of dirs) walk(d);
  return out.sort();
}

/** Every file (absolute path) under `dir`. */
export function walkAll(dir: string): string[] {
  const out: string[] = [];
  const walk = (abs: string) => {
    for (const e of readdirSync(abs, { withFileTypes: true })) {
      const p = path.join(abs, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.isFile()) out.push(p);
    }
  };
  if (existsSync(dir)) walk(dir);
  return out.sort();
}

const ENTITIES: Record<string, string> = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'" };
export const decode = (s: string) => s.replace(/&(?:amp|lt|gt|quot|#39);/g, (m) => ENTITIES[m]);

/** The visible text blocks of a wall document: the body only, style removed, tags removed, entities decoded. */
export function visibleBlocks(html: string): string[] {
  const body = (html.match(/<body[^>]*>([\s\S]*)<\/body>/i) ?? ['', ''])[1];
  const text = body
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<\/(p|h1|h2|div|main|header|footer|section)>/gi, '\n')
    .replace(/<[^>]*>/g, '');
  return decode(text)
    .split('\n')
    .map((l) => l.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
}

/** The text of the single inline <style>, or '' when absent. */
export const styleOf = (html: string) => (html.match(/<style>([\s\S]*?)<\/style>/) ?? ['', ''])[1];

/** `selector{decls}` rules of a flat stylesheet, declarations as a property map. */
export function cssRules(css: string): { selector: string; decls: Record<string, string> }[] {
  return Array.from(css.matchAll(/([^{}]+)\{([^{}]*)\}/g)).map((m) => ({
    selector: m[1].trim(),
    decls: Object.fromEntries(
      m[2]
        .split(';')
        .map((d) => d.trim())
        .filter(Boolean)
        .map((d) => {
          const i = d.indexOf(':');
          return [d.slice(0, i).trim().toLowerCase(), d.slice(i + 1).trim()];
        }),
    ),
  }));
}
