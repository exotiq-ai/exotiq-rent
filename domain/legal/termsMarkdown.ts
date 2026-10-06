/**
 * Strict reader for the signed Terms body (MP-33). It understands exactly the markdown the
 * signed text uses and throws on anything else, so a future version that adds a construct
 * fails the build instead of silently losing text on the page. Pure: no React, no DOM.
 *
 * Supported: one H1 (the title), "##" and "###" headings, paragraphs (every source line break
 * is kept), "- " bullet lists, one pipe table with a separator row, "---" rules, "**bold**",
 * and a line wholly wrapped in single asterisks (italic). Square brackets are plain text.
 */
export type Inline = { kind: 'text' | 'strong' | 'em'; text: string };
export type Block =
  | { kind: 'h2' | 'h3'; text: string; id: string }
  | { kind: 'p'; lines: Inline[][] }
  | { kind: 'ul'; items: Inline[][] }
  | { kind: 'table'; head: Inline[][]; rows: Inline[][][] }
  | { kind: 'rule' };
export type ParsedTerms = { title: string; blocks: Block[] };

/** Anchor id from a heading's own text: "17. X" -> section-17, "22.10 X" -> section-22-10, else a slug. */
export function headingId(text: string): string {
  const sub = /^(\d+)\.(\d+)(?:\s|$)/.exec(text);
  if (sub) return `section-${sub[1]}-${sub[2]}`;
  const top = /^(\d+)\.(?:\s|$)/.exec(text);
  if (top) return `section-${top[1]}`;
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

const fail = (n: number, why: string): never => {
  throw new Error(`Terms markdown, line ${n}: ${why}`);
};

function inline(text: string, n: number): Inline[] {
  const whole = /^\*([^*]+)\*$/.exec(text);
  if (whole) return [{ kind: 'em', text: whole[1] }];
  const parts = text.split('**');
  if (parts.length % 2 === 0) fail(n, 'unbalanced ** (bold must open and close on one line)');
  const out: Inline[] = [];
  parts.forEach((part, i) => {
    if (part.includes('*')) fail(n, 'a stray * (only **bold** pairs and a whole-line *italic* are supported)');
    if (i % 2 === 1 && part === '') fail(n, 'empty bold');
    if (part !== '') out.push({ kind: i % 2 === 1 ? 'strong' : 'text', text: part });
  });
  return out;
}

function cells(line: string, n: number): string[] {
  if (!line.startsWith('|') || !line.endsWith('|') || line.length < 3) fail(n, 'a table row must start and end with a pipe');
  return line.slice(1, -1).split('|').map((c) => c.trim());
}

export function parseTermsMarkdown(md: string): ParsedTerms {
  if (md.includes('\r')) fail(0, 'carriage return (the body is LF only)');
  const lines = md.split('\n');
  const doc = { title: null as string | null };
  const blocks: Block[] = [];
  const ids = new Set<string>();
  let open: 'p' | 'ul' | 'table' | null = null;
  let tableLines: { text: string; n: number }[] = [];

  const flushTable = () => {
    if (tableLines.length < 2) fail(tableLines[0]?.n ?? 0, 'a table needs a header row and a separator row');
    const [h, sep, ...rest] = tableLines;
    if (!/^[|\-: ]+$/.test(sep.text) || !sep.text.includes('-')) fail(sep.n, 'a table without a separator row');
    const head = cells(h.text, h.n);
    if (cells(sep.text, sep.n).length !== head.length) fail(sep.n, 'separator row width differs from the header');
    blocks.push({
      kind: 'table',
      head: head.map((c) => inline(c, h.n)),
      rows: rest.map((r) => {
        const row = cells(r.text, r.n);
        if (row.length !== head.length) fail(r.n, 'row width differs from the header');
        return row.map((c) => inline(c, r.n));
      }),
    });
    tableLines = [];
  };
  const close = () => {
    if (open === 'table') flushTable();
    open = null;
  };

  lines.forEach((line, index) => {
    const n = index + 1;
    if (line === '') return close();
    if (/^\s/.test(line)) fail(n, 'leading whitespace (nesting and indented code are not supported)');
    for (const [bad, why] of [['`', 'a backtick (code)'], ['\\', 'a backslash (escapes)'], ['<', 'HTML or an angle bracket'], ['>', 'HTML or a quote']] as const) {
      if (line.includes(bad)) fail(n, why);
    }
    if (line.includes('](') || line.includes('![')) fail(n, 'link or image syntax');
    if (/^\d+[.)] /.test(line)) fail(n, 'an ordered list');
    if (/^[+*] /.test(line)) fail(n, 'a "+" or "*" bullet');
    if (line === '---') {
      close();
      blocks.push({ kind: 'rule' });
      return;
    }
    if (line.startsWith('#')) {
      const m = /^(#{1,3}) (\S.*)$/.exec(line);
      if (!m) return fail(n, 'a heading deeper than ### or without its space');
      close();
      const text = m[2];
      if (text.includes('*')) fail(n, 'emphasis inside a heading');
      if (m[1] === '#') {
        if (doc.title !== null || blocks.length) fail(n, 'a second H1, or an H1 that is not first');
        doc.title = text;
        return;
      }
      const id = headingId(text);
      if (id === '') fail(n, `heading "${text}" has no id`);
      if (ids.has(id)) fail(n, `duplicate heading id "${id}"`);
      ids.add(id);
      blocks.push({ kind: m[1] === '##' ? 'h2' : 'h3', text, id });
      return;
    }
    if (doc.title === null) fail(n, 'content before the H1');
    if (line.startsWith('- ')) {
      if (open !== 'ul') {
        close();
        blocks.push({ kind: 'ul', items: [] });
        open = 'ul';
      }
      (blocks[blocks.length - 1] as Extract<Block, { kind: 'ul' }>).items.push(inline(line.slice(2), n));
      return;
    }
    if (line.startsWith('|')) {
      if (open !== 'table') {
        close();
        open = 'table';
      }
      tableLines.push({ text: line, n });
      return;
    }
    if (open === 'ul') fail(n, 'text directly under a list item (a continuation line)');
    if (open === 'table') fail(n, 'text directly under a table');
    if (open !== 'p') {
      blocks.push({ kind: 'p', lines: [] });
      open = 'p';
    }
    (blocks[blocks.length - 1] as Extract<Block, { kind: 'p' }>).lines.push(inline(line, n));
  });
  close();
  if (doc.title === null) return fail(0, 'no H1');
  return { title: doc.title, blocks };
}
