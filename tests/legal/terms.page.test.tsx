// MP-33 AC2, AC3, AC4, AC6, AC7: the Terms page is public in every site mode, its headings carry
// stable ids, the version is on the page and on the document element, the body holds no links, and
// the styling follows the legal-page pattern. (AC1, the faithfulness pin, is terms.faithfulness.test.ts.)
// Computed style and scroll clearance need a browser: those are the verify lane's probes; this file
// pins the class contract that makes them true.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/components/analytics/PostHogInit', () => ({
  useCookieConsent: () => ({ ready: false, visibility: 'hidden', choice: { analytics: false, marketing: false }, gpc: false, choose() {}, activeDetails: null, setActiveDetails() {} }),
}));
vi.mock('@/components/drive-exotiq/fonts', () => ({ driveFontClassName: 'font-vars' }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh() {}, push() {}, replace() {}, back() {} }),
  usePathname: () => '/',
  notFound: () => { throw new Error('notFound'); },
}));

import TermsPage, { generateMetadata } from '@/app/terms/page';
import { TermsDocument } from '@/components/browse/TermsDocument';
import { parseTermsMarkdown } from '@/domain/legal/termsMarkdown';
import { TERMS_BODY_MD, TERMS_DOC_ID, TERMS_DOC_VERSION, TERMS_EFFECTIVE } from '@/domain/legal/termsV2';
import config from '../../tailwind.config';
import { compileWith, stripComments } from '../design/lib/scan.mjs';
import { type El, byAttr, classes, elements, norm, parseHtml, textOf } from '../fees/fixtures';

const REPO = fileURLToPath(new URL('../../', import.meta.url));
const read = (rel: string) => readFileSync(join(REPO, rel), 'utf8');
const src = (rel: string) => stripComments(read(rel));
const PAGE = 'app/terms/page.tsx';
const DOC = 'components/browse/TermsDocument.tsx';

afterEach(() => vi.unstubAllEnvs());

const renderPage = () => renderToStaticMarkup(createElement(TermsPage));
const bodyOf = (html: string): El => byAttr(parseHtml(html), 'data-terms-body')[0];
const bodyHtml = (md: string) => renderToStaticMarkup(createElement(TermsDocument, { blocks: parseTermsMarkdown(md).blocks }));
const headings = (root: El) => elements(root).filter((e) => e.tag === 'h2' || e.tag === 'h3');

describe('terms is public in every site mode and browse and saved stay gated', () => {
  it('the page has no gate, keeps its metadata and renders in all four site and browse combinations', () => {
    const page = src(PAGE);
    expect(page).not.toContain('browseEnabled');
    expect(page).not.toContain('notFound');
    expect(read(PAGE)).toMatch(/import \{ LegalPage \} from '@\/components\/browse\/LegalPage'/);
    for (const mode of ['booking', 'marketplace']) {
      for (const browse of ['', 'on']) {
        vi.unstubAllEnvs();
        vi.stubEnv('NEXT_PUBLIC_SITE_MODE', mode);
        vi.stubEnv('NEXT_PUBLIC_MARKETPLACE_BROWSE', browse);
        const label = `${mode}/${browse || 'unset'}`;
        expect(generateMetadata(), label).toEqual({
          title: 'Terms of service | Drive Exotiq',
          description: 'How booking through Drive Exotiq works: who you rent from, what you pay, and what Exotiq is responsible for.',
          robots: { index: false, follow: true },
        });
        const root = parseHtml(renderPage());
        expect(elements(root).filter((e) => e.tag === 'h1').map((h) => norm(textOf(h))), label).toEqual(['Drive Exotiq Terms of Service']);
        expect(byAttr(root, 'data-terms-body'), label).toHaveLength(1);
      }
    }
  });

  it('the planted gate is detected, and browse and saved stay gated exactly as before', () => {
    const planted = stripComments("import { browseEnabled } from '@/domain/booking/config';\nif (!browseEnabled()) notFound();");
    expect(planted.includes('browseEnabled') && planted.includes('notFound')).toBe(true);
    expect(read('app/browse/page.tsx').split('if (!browseEnabled()) notFound();').length - 1).toBe(2);
    expect(read('app/saved/page.tsx')).toContain('if (!renterCaptureUiEnabled() || !browseEnabled()) notFound();');
  });
});

/** Own derivation of the heading ids from the markdown (the production headingId is not reused). */
function derivedIds(md: string): string[] {
  const ids: string[] = [];
  for (const l of md.split('\n')) {
    let m: RegExpExecArray | null;
    if ((m = /^### (\d+)\.(\d+) /.exec(l))) ids.push(`section-${m[1]}-${m[2]}`);
    else if ((m = /^## (\d+)\. /.exec(l))) ids.push(`section-${m[1]}`);
    else if (l.startsWith('## ')) ids.push(l.slice(3).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''));
  }
  return ids;
}
/** Everything AC3 requires of a rendered body: ids only on the headings themselves, unique, each with the offset class. */
function anchorProblems(html: string, want: string[]): string[] {
  const body = bodyOf(html);
  const problems: string[] = [];
  const withId = elements(body).filter((e) => e !== body && 'id' in e.attrs);
  for (const e of withId) if (e.tag !== 'h2' && e.tag !== 'h3') problems.push(`id "${e.attrs.id}" is on a <${e.tag}>, not on a heading`);
  const ids = headings(body).map((h) => h.attrs.id);
  if (JSON.stringify(ids) !== JSON.stringify(want)) problems.push('rendered ids differ from the ids derived from the source');
  if (new Set(ids).size !== ids.length) problems.push('duplicate ids');
  for (const h of headings(body)) if (!classes(h).includes('scroll-mt-20')) problems.push(`${h.attrs.id}: no scroll-mt-20`);
  return problems;
}

describe('every heading has its deterministic id and section-17 is Section 17', () => {
  const html = renderPage();
  const want = derivedIds(TERMS_BODY_MD);

  it('renders 161 unique ids, the source-derived set in order, each on its heading with the offset class', () => {
    expect(want).toHaveLength(161);
    expect(new Set(want).size).toBe(161);
    expect(want.filter((i) => !i.startsWith('section-'))).toEqual(['key-terms-at-a-glance']);
    expect(anchorProblems(html, want)).toEqual([]);
    // Rendering twice yields identical ids.
    expect(headings(bodyOf(renderPage())).map((h) => h.attrs.id)).toEqual(headings(bodyOf(html)).map((h) => h.attrs.id));
    expect(want).toContain('section-22-1');
    expect(want).toContain('section-22-10');
  });

  it('section-17 is the h2 "17. ASSUMPTION OF RISK AND RELEASE", and inserting content ahead of it never moves it', () => {
    const target = headings(bodyOf(html)).find((h) => h.attrs.id === 'section-17');
    expect(target?.tag).toBe('h2');
    expect(norm(textOf(target as El))).toBe('17. ASSUMPTION OF RISK AND RELEASE');
    const planted = TERMS_BODY_MD.replace('\n## Key Terms', '\n### 0.5 A planted subsection\nPlanted text.\n\nA planted paragraph.\n\n## Key Terms');
    expect(planted).not.toBe(TERMS_BODY_MD);
    const after = headings(bodyOf(bodyHtml(planted)));
    const moved = after.find((h) => h.attrs.id === 'section-17');
    expect(norm(textOf(moved as El))).toBe('17. ASSUMPTION OF RISK AND RELEASE');
    expect(after.map((h) => h.attrs.id)).toEqual(['section-0-5', ...want]);
  });

  it('the anchor checks can fail: an id on a wrapper, a missing offset class, a duplicate id', () => {
    const base = bodyHtml(TERMS_BODY_MD);
    expect(anchorProblems(base, want)).toEqual([]);
    expect(anchorProblems(base.replace('<section class="space-y-4">', '<section id="wrapper" class="space-y-4">'), want).length).toBeGreaterThan(0);
    expect(anchorProblems(base.replace('scroll-mt-20', 'scroll-mt-0'), want).length).toBeGreaterThan(0);
    expect(anchorProblems(base.replace('id="section-22-10"', 'id="section-22-1"'), want).length).toBeGreaterThan(0);
  });
});

describe('version and effective date are on the page and on the document element', () => {
  const html = renderPage();
  const root = parseHtml(html);
  const text = norm(textOf(root));

  it('shows the signed header and closing lines, the last-updated line and the document attributes', () => {
    const body = bodyOf(html);
    expect(body.attrs['data-doc-id']).toBe('terms');
    expect(body.attrs['data-doc-version']).toBe('2.0.0');
    expect(`${TERMS_DOC_ID}/${TERMS_DOC_VERSION}`).toBe('terms/2.0.0');
    expect(TERMS_EFFECTIVE).toBe('2026-10-06');
    expect(text).toContain('Last updated October 6, 2026');
    const header = `Effective Date: October 6, 2026 | Version ${TERMS_DOC_VERSION}`;
    const bodyText = norm(textOf(body));
    expect(bodyText.indexOf(header)).toBeGreaterThan(-1);
    expect(bodyText.indexOf(header)).toBeLessThan(bodyText.indexOf('Key Terms at a Glance'));
    expect(headings(body)[0].tag).toBe('h2'); // the header line sits before the first heading
    const closing = 'Version 2.0.0, effective October 6, 2026. Counsel sign-off recorded 2026-10-06.';
    expect(bodyText.split(closing)).toHaveLength(2);
    expect(bodyText.endsWith(closing)).toBe(true);
    // No version text outside the signed body except LegalPage's own line (which carries no version).
    expect(text.split('Version 2.0.0').length - 1).toBe(2);
  });

  it('the document attributes come from the constants, never from literals', () => {
    const doc = src(DOC);
    expect(doc).toContain('data-doc-id={TERMS_DOC_ID}');
    expect(doc).toContain('data-doc-version={TERMS_DOC_VERSION}');
    expect(doc).not.toMatch(/2\.0\.0/);
    expect(src(PAGE)).not.toMatch(/2\.0\.0/);
    // The planted drift: a constant that disagrees with the text is the one thing this pins against.
    expect(TERMS_BODY_MD).toContain(`**Effective Date: October 6, 2026 | Version ${TERMS_DOC_VERSION}**`);
    expect(TERMS_BODY_MD).toContain(`*Version ${TERMS_DOC_VERSION}, effective October 6, 2026.`);
  });
});

describe("section 1.4's policies are plain text and the body has no links", () => {
  it('has no anchor in the body, and the three policy names are text in order', () => {
    const body = bodyOf(renderPage());
    expect(elements(body).filter((e) => e.tag === 'a')).toEqual([]);
    const text = norm(textOf(body));
    const at = ['Cookie Policy', 'SMS and Text Messaging Policy', 'Copyright and DMCA Policy'].map((p) => text.indexOf(`the Drive Exotiq ${p}`));
    expect(at.every((i) => i > -1)).toBe(true);
    expect([...at].sort((a, b) => a - b)).toEqual(at);
  });
  it('link syntax is rejected rather than rendered', () => {
    expect(() => parseTermsMarkdown(TERMS_BODY_MD.replace('the Drive Exotiq Cookie Policy;', '[the Drive Exotiq Cookie Policy](/cookies);'))).toThrow(/link or image syntax/);
    expect(() => parseTermsMarkdown(TERMS_BODY_MD.replace('support@exotiq.ai', '<support@exotiq.ai>'))).toThrow(/HTML/);
  });
});

/** Every source file under a directory, repo-relative, tests excluded. */
function sources(dir: string): string[] {
  const out: string[] = [];
  for (const e of readdirSync(join(REPO, dir), { withFileTypes: true })) {
    const rel = `${dir}/${e.name}`;
    if (e.isDirectory()) { if (e.name !== 'node_modules' && e.name !== '.next') out.push(...sources(rel)); }
    else if (/\.(tsx?|mts|css)$/.test(e.name) && !/\.test\./.test(e.name)) out.push(rel);
  }
  return out.sort();
}

describe('styling follows the legal page pattern: tokens only, no gold, 16px body, offset anchors, server-only', () => {
  const html = renderPage();
  const body = bodyOf(html);
  const all = new Set(elements(body).flatMap(classes));
  const SIZE_STEPS = ['micro', 'label', 'body-sm', 'body', 'body-lg', 'title-sm', 'title', 'heading', 'display', 'display-lg', 'display-xl'];

  it('uses tone utilities and the eleven type steps only, with no gold, hex, rgba or box', () => {
    for (const rel of [PAGE, DOC]) {
      const s = src(rel);
      expect(s, rel).not.toMatch(/gold/i);
      expect(s, rel).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
      expect(s, rel).not.toMatch(/rgba?\(/);
      expect(s, rel).not.toMatch(/text-\[/);
      expect(s, rel).not.toMatch(/\brounded/);
    }
    for (const c of Array.from(all)) {
      const bare = c.replace(/^!/, '');
      if (/^text-/.test(bare) && !/^text-(left|ink|muted|faint)$/.test(bare)) expect(SIZE_STEPS, `size class ${c}`).toContain(bare.slice(5));
      expect(c, c).not.toMatch(/gold|\[|#/);
    }
  });

  it('body text is the 16px step; section headings are larger, normal case and ink, and the sub-headings sit between', () => {
    expect(classes(body)).toContain('text-body-lg');
    const h2 = headings(body).find((h) => h.tag === 'h2') as El;
    const h3 = headings(body).find((h) => h.tag === 'h3') as El;
    for (const c of ['!text-title', '!normal-case', '!tracking-normal', '!text-ink', 'scroll-mt-20']) expect(classes(h2), c).toContain(c);
    for (const c of ['text-title-sm', 'text-ink', 'scroll-mt-20']) expect(classes(h3), c).toContain(c);
    // 22px headings over 18px sub-headings over 16px body: the three steps the type scale offers in that range.
    const px = (step: string) => Number.parseFloat(String((config.theme?.extend?.fontSize as unknown as Record<string, [string]>)[step][0]));
    expect([px('body-lg'), px('title-sm'), px('title')]).toEqual([16, 18, 22]);
  });

  it("the headings' important modifiers compile to important declarations (the shell's descendant rule cannot win)", async () => {
    const { css } = await compileWith(config, ['!text-title', '!normal-case', '!tracking-normal', '!text-ink', '!leading-snug']);
    for (const name of ['text-title', 'normal-case', 'tracking-normal', 'text-ink', 'leading-snug']) {
      expect(css, name).toMatch(new RegExp(`\\.\\\\!${name}\\s*\\{[^}]*!important`));
    }
  });

  it('the contact table uses hairlines only and its cells wrap', () => {
    const cells = elements(body).filter((e) => e.tag === 'td' || e.tag === 'th');
    expect(cells).toHaveLength(14);
    for (const c of cells) expect(classes(c).some((x) => x === 'border-b') && classes(c).includes('border-line')).toBe(true);
    for (const c of elements(body).filter((e) => e.tag === 'td')) expect(classes(c)).toContain('break-words');
    expect(classes(elements(body).find((e) => e.tag === 'table') as El)).toContain('w-full');
  });

  it('is server-only and only the page and the renderer import the legal domain files', () => {
    for (const rel of [PAGE, DOC, ...sources('domain/legal')]) {
      expect(read(rel), rel).not.toMatch(/['"]use client['"]/);
      expect(read(rel), rel).not.toContain('dangerouslySetInnerHTML');
    }
    const importers = [...sources('app'), ...sources('components')].filter((rel) => !rel.startsWith('components/marketplace/') && /domain\/legal\//.test(read(rel)));
    expect(importers).toEqual([PAGE, DOC]);
    // Planted: a second importer would be listed by the same scan.
    expect(/domain\/legal\//.test("import { TERMS_DOC_ID } from '@/domain/legal/termsV2';")).toBe(true);
  });
});
