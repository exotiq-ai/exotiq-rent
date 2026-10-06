// MP-18 AC11: app/error.tsx, the one segment error boundary, in the 404's voice. It wears MP-17's
// PageFrame (driver errata #1), never prints error.message or a stack, shows a digest only as a
// reference, claims nothing about charges, and imports so little that it cannot fail for the
// reasons it exists (no analytics, no consent control, no booking chrome). Its icon is text-muted:
// gold in a new file trips MP-16's budget (driver errata #2).
// Next's runtime behaviour (status code, first response) is observed on a production build by the
// evidence run, not asserted here; these tests pin the boundary's content and its import graph.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createElement, type ComponentType } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/components/drive-exotiq/fonts', () => ({ driveFontClassName: 'font-vars' }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: () => {}, push: () => {} }), usePathname: () => '/' }));

import { stripComments } from '../../tests/design/lib/scan.mjs';
import { goldCount } from '../../tests/restraint/restraintScan';
import { type El, elements, norm, parseHtml, textOf } from '../../tests/fees/fixtures';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const REL = 'app/error.tsx';
type Boundary = ComponentType<{ error: Error & { digest?: string }; reset: () => void }>;
const load = async (): Promise<Boundary | undefined> => ((await import('../../app/error').catch(() => ({}))) as { default?: Boundary }).default;

afterEach(() => vi.unstubAllEnvs());

async function render(error: Error & { digest?: string } = new Error('boom')): Promise<El> {
  const Boundary = await load();
  expect(Boundary, `${REL} has no default export`).toBeTypeOf('function');
  return parseHtml(renderToStaticMarkup(createElement(Boundary!, { error, reset: () => {} })));
}
/** Visible text: the rendered text minus the site bar's image alt (an attribute, not text). */
const visible = (root: El) => norm(textOf(root));

// ---- import graph -----------------------------------------------------------------------------

const specifiers = (src: string) => Array.from(stripComments(src).matchAll(/(?:import|export)\s[^;]*?from\s+['"]([^'"]+)['"]/g), (m) => m[1]);
const ALLOWED = [
  'react', 'next/link', 'next/navigation', 'lucide-react',
  '@/components/browse/PageFrame', '@/components/browse/tokens', '@/components/drive-exotiq/fonts', '@/domain/booking/config',
  '../components/browse/PageFrame', '../components/browse/tokens', '../components/drive-exotiq/fonts', '../domain/booking/config',
];
const FORBIDDEN = /components\/analytics|CookieControls|BrowseChrome|BookingChrome|PhoneViewport|posthog/i;

/** Resolve a local specifier to a repo-relative source file, or null for a package or nothing on disk. */
function resolveLocal(from: string, spec: string, exists: (rel: string) => boolean): string | null {
  const base = spec.startsWith('@/') ? spec.slice(2) : spec.startsWith('.') ? join(dirname(from), spec) : null;
  if (base === null) return null;
  for (const ext of ['', '.ts', '.tsx', '/index.ts', '/index.tsx']) if (/\.[cm]?[tj]sx?$/.test(base + ext) && exists(base + ext)) return base + ext;
  return null;
}
/** Findings for a boundary's direct imports and its local import closure. */
export function importProblems(entry: string, readSrc: (rel: string) => string, exists = (rel: string) => existsSync(join(ROOT, rel))): string[] {
  const problems: string[] = [];
  for (const s of specifiers(readSrc(entry))) if (!ALLOWED.includes(s)) problems.push(`${entry} imports ${s}`);
  const seen = new Set<string>();
  const walk = (rel: string) => {
    if (seen.has(rel)) return;
    seen.add(rel);
    if (FORBIDDEN.test(rel)) problems.push(`closure reaches ${rel}`);
    for (const s of specifiers(readSrc(rel))) {
      if (FORBIDDEN.test(s)) problems.push(`${rel} imports ${s}`);
      const next = resolveLocal(rel, s, exists);
      if (next) walk(next);
    }
  };
  walk(entry);
  return problems;
}

describe('MP-18 error boundary (AC11)', () => {
  it('error boundary shows title, try again and the home link', async () => {
    vi.stubEnv('NEXT_PUBLIC_SITE_MODE', 'booking');
    vi.stubEnv('NEXT_PUBLIC_DEFAULT_TEAM_SLUG', undefined);
    const root = await render();
    const h1 = elements(root).filter((e) => e.tag === 'h1');
    expect(h1.map((e) => norm(textOf(e)))).toEqual(["That didn't go to plan."]);
    const buttons = elements(root).filter((e) => e.tag === 'button');
    expect(buttons.map((b) => norm(textOf(b)))).toEqual(['Try again']);
    expect(buttons[0].attrs.type).toBe('button');
    expect(buttons[0].attrs['aria-busy']).toBe('false');
    const home = elements(root).filter((e) => e.tag === 'a' && norm(textOf(e)) === 'Continue browsing');
    expect(home.map((a) => a.attrs.href)).toEqual(['/exotiq']);
    // MP-17's PageFrame: the frame, its one site bar, no wizard chrome (no Back, no Close, no progress).
    expect(elements(root).filter((e) => e.attrs['data-chrome'] === 'page-frame')).toHaveLength(1);
    expect(elements(root).filter((e) => e.tag === 'header')).toHaveLength(1);
    expect(elements(root).filter((e) => e.attrs['data-chrome'] === 'progress' || ['Back', 'Close booking flow'].includes(e.attrs['aria-label'] ?? ''))).toEqual([]);
    // The 404's icon circle, muted like every circle (MP-16), with an icon inside.
    const circle = elements(root).find((e) => (e.attrs.class ?? '').includes('h-14 w-14'));
    expect(circle?.attrs.class?.split(/\s+/)).toContain('text-muted');
    expect(circle && elements(circle).some((e) => e.tag === 'svg')).toBe(true);

    // Marketplace mode and a custom team slug flow through homeLink().
    vi.stubEnv('NEXT_PUBLIC_DEFAULT_TEAM_SLUG', 'acme');
    expect(elements(await render()).filter((e) => e.tag === 'a' && norm(textOf(e)) === 'Continue browsing').map((a) => a.attrs.href)).toEqual(['/acme']);
    vi.stubEnv('NEXT_PUBLIC_SITE_MODE', 'marketplace');
    expect(elements(await render()).filter((e) => e.tag === 'a' && norm(textOf(e)) === 'Back to Drive Exotiq').map((a) => a.attrs.href)).toEqual(['/']);
  });

  it('error boundary never prints the message or stack', async () => {
    const error = new Error('sk_live_SECRET_123 relation "renters" does not exist');
    error.stack = 'Error: sk_live_SECRET_123\n    at secretFn (/srv/app/.next/server/chunks/secret.js:1:1)';
    const html = renderToStaticMarkup(createElement((await load())!, { error, reset: () => {} }));
    for (const leak of ['sk_live', 'SECRET', 'renters', 'secretFn', '/srv/app', 'secret.js']) expect(html, leak).not.toContain(leak);
    expect(stripComments(readFileSync(join(ROOT, REL), 'utf8'))).not.toMatch(/error\.(message|stack)|String\(error\)|\{error\}/);
  });

  it('error boundary shows a reference only when a digest exists', async () => {
    const withDigest = Object.assign(new Error('x'), { digest: 'abc123' });
    expect(visible(await render(withDigest))).toContain('Reference: abc123');
    expect(visible(await render(new Error('x')))).not.toContain('Reference');
    expect(visible(await render(Object.assign(new Error('x'), { digest: '' })))).not.toContain('Reference');
  });

  it('error boundary copy makes no payment claims and tells booking renters to check email', async () => {
    const text = visible(await render(Object.assign(new Error('x'), { digest: 'abc123' })));
    expect(text).not.toMatch(/\b(charged?|charges|refunds?|payments?|paid|card|booked|reserved)\b/i);
    expect(text).toContain('check your email for a confirmation before you retry');
    expect(text).toContain('Something went wrong on our side while loading this page.');
  });

  it('try again refreshes then resets in a transition and cannot double fire', () => {
    // No DOM here: the decision is pinned in source; the verify lane's AC11-retry.json clicks it.
    const src = stripComments(readFileSync(join(ROOT, REL), 'utf8'));
    expect(src.trimStart().startsWith("'use client';")).toBe(true);
    expect(src).toMatch(/const \[pending, startTransition\] = useTransition\(\);/);
    expect(src).toMatch(/if \(pending\) return;\s*startTransition\(\(\) => \{\s*router\.refresh\(\);\s*reset\(\);\s*\}\);/);
    expect(src).toMatch(/aria-busy=\{pending\}/);
    expect(src).toContain("{pending ? 'Trying again…' : 'Try again'}");
    expect(goldCount(src)).toBe(0);
  });

  it('error boundary imports no chrome or analytics', () => {
    const readSrc = (rel: string) => readFileSync(join(ROOT, rel), 'utf8');
    expect(existsSync(join(ROOT, REL)), `${REL} is missing`).toBe(true);
    expect(importProblems(REL, readSrc)).toEqual([]);
    expect(specifiers(readSrc(REL))).toEqual(expect.arrayContaining(['next/navigation', 'react']));
    expect(specifiers(readSrc(REL)).some((s) => s.endsWith('components/browse/PageFrame'))).toBe(true);
    expect(stripComments(readSrc(REL))).toContain('homeLink()');
    // Planted: each forbidden import is caught directly or through the closure.
    const fake: Record<string, string> = {
      'app/error.tsx': "import { CookieControls } from '@/components/analytics/CookieControls';\nimport { Frame } from './frame';",
      'app/frame.tsx': "import { PhoneViewport } from '@/components/drive-exotiq/BookingChrome';",
    };
    const planted = importProblems('app/error.tsx', (rel) => fake[rel] ?? '', (rel) => rel in fake);
    expect(planted).toContain('app/error.tsx imports @/components/analytics/CookieControls');
    expect(planted).toContain('app/frame.tsx imports @/components/drive-exotiq/BookingChrome');
    expect(importProblems('app/error.tsx', () => "import { BrowseChrome } from '@/components/browse/BrowseChrome';", () => false)).toContain('app/error.tsx imports @/components/browse/BrowseChrome');
  });

  it('no other error boundary exists under app', () => {
    const found: string[] = [];
    const walk = (dir: string) => {
      for (const e of readdirSync(join(ROOT, dir), { withFileTypes: true })) {
        const rel = `${dir}/${e.name}`;
        if (e.isDirectory()) walk(rel);
        else if (/^(global-)?error\.(tsx?|jsx?)$/.test(e.name)) found.push(rel);
      }
    };
    walk('app');
    expect(found).toEqual([REL]);
  });
});
