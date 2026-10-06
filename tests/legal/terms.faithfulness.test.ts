// MP-33 AC1: the Terms page says exactly what counsel signed. Three-way faithfulness: the signed
// source (env-gated), the vendored copy, and the rendered page all normalize to one pinned sha256.
// This file owns its own extractors (it does not reuse textOf from tests/fees, which joins text with
// no separator, and it shares no code with domain/legal). The pin changes only with a new version.
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/components/analytics/PostHogInit', () => ({
  useCookieConsent: () => ({ ready: false, visibility: 'hidden', choice: { analytics: false, marketing: false }, gpc: false, choose() {}, activeDetails: null, setActiveDetails() {} }),
}));
vi.mock('@/components/drive-exotiq/fonts', () => ({ driveFontClassName: 'font-vars' }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh() {}, push() {}, replace() {}, back() {} }),
  usePathname: () => '/',
  notFound: () => { throw new Error('notFound'); },
}));

import TermsPage from '@/app/terms/page';
import { TermsDocument } from '@/components/browse/TermsDocument';
import { parseTermsMarkdown } from '@/domain/legal/termsMarkdown';
import { TERMS_BODY_MD } from '@/domain/legal/termsV2';

/** The pin (spec "The pin and the normalization"). Computed at refine from the signed source, re-derived by the locate seat. */
const PIN = { sha256: '7bfad91515723575492785ad638689dfa42177d048c81d89be4d105897ebe3ca', length: 55317 };
const sha = (s: string) => createHash('sha256').update(s, 'utf8').digest('hex');
const collapse = (s: string) => s.normalize('NFC').replace(/\s+/g, ' ').trim();

/** The body cut: first "# " line through the last non-blank line before "## Revision Notes", minus a trailing rule. */
function cutBody(text: string): string {
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  const start = lines.findIndex((l) => l.startsWith('# '));
  const rev = lines.findIndex((l) => l.startsWith('## Revision Notes'));
  if (start < 0 || rev < 0) throw new Error('the signed source has no H1 or no "## Revision Notes" heading');
  let end = rev - 1;
  while (end > start && (lines[end].trim() === '' || lines[end] === '---')) end--;
  return lines.slice(start, end + 1).join('\n');
}

/** N for one source line (null when the line is dropped). */
function normLine(l: string): string | null {
  if (l === '---') return null;
  if (/^[|\-: ]+$/.test(l) && l.includes('|')) return null;
  if (l.startsWith('|')) l = l.replace(/^\|/, '').replace(/\|$/, '').replace(/\|/g, ' ');
  return l.replace(/^(###|##|#) /, '').replace(/^- /, '').replace(/\*/g, '');
}
/** N(source): the single normalization the pin is defined over. */
const normSource = (body: string): string => collapse(body.split('\n').map(normLine).filter((l): l is string => l !== null).join('\n'));
/** One entry per source line that has text, each collapsed: what the rendered page must reproduce line for line. */
const sourceLines = (body: string): string[] => body.split('\n').map(normLine).filter((l): l is string => l !== null).map(collapse).filter(Boolean);

const BLOCK = 'p|li|ul|h1|h2|h3|table|thead|tbody|tr|td|th|section|div|hr|br';
const LINE_BREAKS = 'p|li|ul|h1|h2|h3|table|thead|tbody|tr|section|div|hr|br';
function decode(s: string): string {
  return s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/&amp;/g, '&');
}
const tagRe = (names: string) => new RegExp(`</?(?:${names})(?:\\s[^>]*)?/?>`, 'g');
function stripTags(html: string, lineTags: string, sep: string): string {
  const out = html
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(tagRe(lineTags), sep)
    .replace(tagRe('td|th'), ' ')
    .replace(/<\/?(?:strong|em|span)(?:\s[^>]*)?>/g, '');
  const stray = /<[a-zA-Z/!][^>]*>/.exec(out);
  if (stray) throw new Error(`the extractor met a tag it does not account for: ${stray[0].slice(0, 80)}`);
  return decode(out);
}
/** N(render): block boundaries become a space, inline tags none, the five React entities decoded. */
const normRender = (html: string): string => collapse(stripTags(html, BLOCK, ' '));
/** The rendered text split at every line break and block boundary (the cells of one row stay on one line). */
const renderedLines = (html: string): string[] => stripTags(html, LINE_BREAKS, '\u0000').split('\u0000').map(collapse).filter(Boolean);

/** Inner html of the first <h1> and of the [data-terms-body] container (balanced on div). */
function pageParts(html: string): { h1: string; body: string } {
  const h1s = html.match(/<h1\b[^>]*>[\s\S]*?<\/h1>/g) ?? [];
  if (h1s.length !== 1) throw new Error(`expected one <h1>, found ${h1s.length}`);
  const open = /<div\b[^>]*\bdata-terms-body\b[^>]*>/.exec(html);
  if (!open) throw new Error('no [data-terms-body] container');
  let depth = 1;
  const re = /<(\/?)div\b[^>]*>/g;
  re.lastIndex = open.index + open[0].length;
  for (let m = re.exec(html); m; m = re.exec(html)) {
    depth += m[1] ? -1 : 1;
    if (depth === 0) return { h1: h1s[0].replace(/^<h1\b[^>]*>|<\/h1>$/g, ''), body: html.slice(open.index + open[0].length, m.index) };
  }
  throw new Error('[data-terms-body] is not closed');
}
const pageText = (html: string): string => { const p = pageParts(html); return normRender(`${p.h1} <p>${p.body}</p>`); };
const bodyHtml = (md: string): string => renderToStaticMarkup(createElement(TermsDocument, { blocks: parseTermsMarkdown(md).blocks }));
const wholePage = (md: string): string => `<h1>${parseTermsMarkdown(md).title}</h1>${bodyHtml(md)}`;
const matchesPin = (text: string, pin = PIN): boolean => text.length === pin.length && sha(text) === pin.sha256;

/** The counts every rendering must reproduce, derived from a body by its own regexes. */
function counts(body: string) {
  const lines = body.split('\n');
  const isBlock = (l: string) => /^(#|- |\||---$)/.test(l);
  let breaks = 0;
  for (let i = 1; i < lines.length; i++) if (lines[i] && lines[i - 1] && !isBlock(lines[i]) && !isBlock(lines[i - 1])) breaks++;
  const pipes = lines.filter((l) => l.startsWith('|') && !/^[|\-: ]+$/.test(l));
  const italic = lines.filter((l) => /^\*[^*]+\*$/.test(l)).length;
  return {
    breaks,
    items: lines.filter((l) => l.startsWith('- ')).length,
    h2: lines.filter((l) => l.startsWith('## ')).length,
    h3: lines.filter((l) => l.startsWith('### ')).length,
    rules: lines.filter((l) => l === '---').length,
    tableRows: pipes.length,
    cells: pipes.reduce((n, l) => n + l.slice(1, -1).split('|').length, 0),
    strong: lines.filter((l) => !/^\*[^*]+\*$/.test(l)).reduce((n, l) => n + (l.match(/\*\*/g) ?? []).length, 0) / 2,
    italic,
  };
}
const tagCount = (html: string, tag: string) => (html.match(new RegExp(`<${tag}(?=[\\s/>])`, 'g')) ?? []).length;
const FORBIDDEN = ['doc_id:', 'Revision Notes', 'legal_assents', 'open_items', 'for counsel'];
const CLOSING = 'Version 2.0.0, effective October 6, 2026. Counsel sign-off recorded 2026-10-06.';

describe('the rendered Terms equal the signed body, the vendored copy and the pin agree, and unsupported markdown throws', () => {
  const html = renderToStaticMarkup(createElement(TermsPage));
  const parts = pageParts(html);

  it('(a) the vendored copy normalizes to the pinned length and sha256', () => {
    const n = normSource(TERMS_BODY_MD);
    expect(n.length).toBe(PIN.length);
    expect(sha(n)).toBe(PIN.sha256);
    expect(TERMS_BODY_MD.startsWith('# Drive Exotiq Terms of Service\n')).toBe(true);
    expect(TERMS_BODY_MD.endsWith('Counsel sign-off recorded 2026-10-06.*')).toBe(true);
  });

  // The signed source lives one folder above the repo, so this one runs only where it is named.
  const SOURCE = process.env.MP33_TERMS_SOURCE;
  it.skipIf(!SOURCE)('(b) the signed source cuts to the same normalized body as the vendored copy', () => {
    expect(existsSync(SOURCE as string), `MP33_TERMS_SOURCE is set but ${SOURCE} does not exist`).toBe(true);
    const cut = cutBody(readFileSync(SOURCE as string, 'utf8'));
    expect(normSource(cut)).toBe(normSource(TERMS_BODY_MD));
    expect(matchesPin(normSource(cut))).toBe(true);
    expect(cut, 'the vendored constant is the cut body, byte for byte').toBe(TERMS_BODY_MD);
  });
  it('(b) the source comparison fails on a one character difference', () => {
    const planted = TERMS_BODY_MD.replace('Exotiq Inc.', 'Exotiq Inc,');
    expect(planted).not.toBe(TERMS_BODY_MD);
    expect(normSource(planted)).not.toBe(normSource(TERMS_BODY_MD));
    expect(matchesPin(normSource(planted))).toBe(false);
    expect(cutBody(`front\n---\n\n${TERMS_BODY_MD}\n\n---\n\n## Revision Notes\nx\n`)).toBe(TERMS_BODY_MD);
  });

  it('(c) the rendered page text is the signed text, character for character', () => {
    const expected = normSource(TERMS_BODY_MD);
    const got = pageText(html);
    expect(got).toBe(expected);
    expect(matchesPin(got)).toBe(true);
    for (const word of FORBIDDEN) expect(got, word).not.toContain(word);
    expect(got.split(CLOSING).length - 1, 'the closing line appears exactly once').toBe(1);
    expect(got.endsWith(CLOSING)).toBe(true);
    expect(normRender(parts.body).endsWith(CLOSING)).toBe(true);
  });

  it('(d) structure survives: line breaks, lists, the contact table, bold and the closing italic', () => {
    const want = counts(TERMS_BODY_MD);
    expect(want).toMatchObject({ breaks: 91, items: 169, h2: 29, h3: 132, rules: 29, tableRows: 7, cells: 14, italic: 1 });
    const b = parts.body;
    expect(tagCount(b, 'br')).toBe(want.breaks);
    expect(tagCount(b, 'li')).toBe(want.items);
    expect(tagCount(b, 'h2')).toBe(want.h2);
    expect(tagCount(b, 'h3')).toBe(want.h3);
    expect(tagCount(b, 'section')).toBe(want.h2);
    expect(tagCount(b, 'hr')).toBe(want.rules);
    expect(tagCount(b, 'strong')).toBe(want.strong);
    expect(tagCount(b, 'em')).toBe(want.italic);
    expect(tagCount(b, 'table')).toBe(1);
    expect(tagCount(b, 'thead')).toBe(1);
    expect(tagCount(b, 'tr')).toBe(want.tableRows);
    expect(tagCount(b, 'th') + tagCount(b, 'td')).toBe(want.cells);
    expect(b).toMatch(/<em>Version 2\.0\.0, effective October 6, 2026\. Counsel sign-off recorded 2026-10-06\.<\/em><\/p>$/);
    // Every <li> sits in a <ul>, and every source line starts on its own line in the markup.
    expect(b.replace(/<ul\b[^>]*>[\s\S]*?<\/ul>/g, '')).not.toContain('<li');
    const rendered = [...renderedLines(`<h1>${parts.h1}</h1>${parts.body}`)];
    expect(rendered).toEqual(sourceLines(TERMS_BODY_MD));
    for (const probe of ['(a) check a box or click a button', '(b) submit a booking request', '(a) the Drive Exotiq Privacy Notice;', '(d) the Drive Exotiq Copyright and DMCA Policy; and']) {
      expect(rendered.some((l) => l.startsWith(probe)), probe).toBe(true);
    }
  });

  describe('(e) fails loudly and never drops', () => {
    const base = wholePage(TERMS_BODY_MD);
    const text = (h: string) => pageText(h);

    it('a planted change in the constant, the output, the pin, a line break or an added sentence is caught', () => {
      expect(text(base)).toBe(normSource(TERMS_BODY_MD)); // the unplanted control passes the same checks
      expect(matchesPin(text(wholePage(TERMS_BODY_MD.replace('Exotiq Inc.', 'Exotiq Inc,'))))).toBe(false);
      expect(matchesPin(text(base.replace('Operator', 'Operatoz')))).toBe(false);
      expect(matchesPin(text(base), { ...PIN, sha256: PIN.sha256.replace(/.$/, '0') })).toBe(false);
      expect(matchesPin(text(base), { ...PIN, length: PIN.length + 1 })).toBe(false);
      // One line break dropped: the text is unchanged, so only the line-for-line check can see it.
      const joined = base.replace('<br/>', ' ');
      expect(text(joined)).toBe(normSource(TERMS_BODY_MD));
      expect(renderedLines(joined)).not.toEqual(sourceLines(TERMS_BODY_MD));
      // An extra sentence inside the body container.
      const extra = base.replace(/<\/div>$/, '<p>An extra sentence.</p></div>');
      expect(extra).not.toBe(base);
      expect(matchesPin(text(extra))).toBe(false);
      // A front-matter line or an appendix line slipping into the body.
      const leaked = wholePage(TERMS_BODY_MD.replace('\n## Key Terms', '\ndoc_id: terms\n\n## Key Terms'));
      expect(FORBIDDEN.some((w) => text(leaked).includes(w))).toBe(true);
    });

    const WRAP = (extra: string) => `# T\n\n## 1. Scope\n\n${extra}\n`;
    const THROWS: Record<string, string> = {
      'link syntax': 'see [the policy](https://example.com)',
      'image syntax': '![logo](x.png)',
      'a code span': 'use `code` here',
      'a code fence': '```\ncode\n```',
      'raw HTML': 'a <b>bold</b> word',
      'an ordered list': '1. first\n2. second',
      'a deeper heading': '#### Too deep',
      'a nested bullet': '- one\n  - nested',
      'indented text': '  indented',
      'a block quote': '> quoted',
      'a plus bullet': '+ item',
      'a star bullet': '* item',
      'a backslash': 'a \\ b',
      'an unbalanced bold': 'one **bold and not closed',
      'a stray asterisk': 'one * star',
      'a table without a separator row': '| a | b |\n| c | d |',
      'text under a list item': '- item\ncontinues here',
      'a duplicate heading id': '### 1.1 One\n\n### 1.1 Again',
      'a second H1': '# Another title',
      'a carriage return': 'a\r\nb',
    };
    it.each(Object.entries(THROWS))('the parser throws on %s', (_name, extra) => {
      expect(() => parseTermsMarkdown(WRAP(extra))).toThrow(/Terms markdown/);
    });
    it('the parser does not throw on literal square brackets or a pipe in running text', () => {
      const ok = parseTermsMarkdown(WRAP('hosted at exotiq.rent/[operator name] or Phone: (406) | Text: (938)'));
      expect(ok.blocks).toHaveLength(2);
      expect(ok.blocks[1]).toMatchObject({ kind: 'p' });
    });
    it('the real body parses, and the parser accepts nothing it would then drop', () => {
      const parsed = parseTermsMarkdown(TERMS_BODY_MD);
      expect(parsed.title).toBe('Drive Exotiq Terms of Service');
      expect(parsed.blocks.filter((b) => b.kind === 'h2' || b.kind === 'h3')).toHaveLength(161);
    });
  });
});
