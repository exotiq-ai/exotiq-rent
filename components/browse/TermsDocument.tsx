import { Fragment, type ReactNode } from 'react';
import type { Block, Inline } from '@/domain/legal/termsMarkdown';
import { TERMS_DOC_ID, TERMS_DOC_VERSION } from '@/domain/legal/termsV2';

/**
 * The signed Terms body, rendered from its parsed blocks (MP-33). Server component, no state:
 * it adds nothing to the text, drops nothing and reorders nothing; tests/legal pins that. The
 * mapping from markdown to markup is fixed by the spec; the classes are tone and type-scale
 * tokens only. The shell's own rule styles every h2 as a small tracked label, so the section
 * headings here carry important modifiers to read as headings; every heading with an id clears
 * the pinned site bar when a link lands on it.
 */
const heading2 = 'scroll-mt-20 !text-title !normal-case !tracking-normal !leading-snug !text-ink font-medium';
const heading3 = 'scroll-mt-20 pt-2 text-title-sm leading-snug text-ink font-medium';

function Inlines({ parts }: { parts: Inline[] }) {
  return (
    <>
      {parts.map((part, i) =>
        part.kind === 'strong' ? <strong key={i}>{part.text}</strong> : part.kind === 'em' ? <em key={i}>{part.text}</em> : <Fragment key={i}>{part.text}</Fragment>,
      )}
    </>
  );
}

function Piece({ block }: { block: Block }): ReactNode {
  switch (block.kind) {
    case 'h2':
      return <h2 id={block.id} className={heading2}>{block.text}</h2>;
    case 'h3':
      return <h3 id={block.id} className={heading3}>{block.text}</h3>;
    case 'p':
      return (
        <p>
          {block.lines.map((line, i) => (
            <Fragment key={i}>
              {i > 0 && <br />}
              <Inlines parts={line} />
            </Fragment>
          ))}
        </p>
      );
    case 'ul':
      return (
        <ul className="list-disc space-y-2 pl-6 marker:text-faint">
          {block.items.map((item, i) => (
            <li key={i}><Inlines parts={item} /></li>
          ))}
        </ul>
      );
    case 'table':
      return (
        <table className="w-full border-collapse text-left">
          <thead>
            <tr>
              {block.head.map((cell, i) => (
                <th key={i} className="border-b border-line py-2 pr-4 align-top font-medium text-ink"><Inlines parts={cell} /></th>
              ))}
            </tr>
          </thead>
          <tbody>
            {block.rows.map((row, r) => (
              <tr key={r}>
                {row.map((cell, i) => (
                  <td key={i} className="border-b border-line py-2 pr-4 align-top break-words"><Inlines parts={cell} /></td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      );
    case 'rule':
      return null;
  }
}

/** Blocks grouped for markup: a "##" opens a section, a rule closes it (and renders as a divider). */
function groups(blocks: Block[]): ({ section: boolean; blocks: Block[] } | 'rule')[] {
  const out: ({ section: boolean; blocks: Block[] } | 'rule')[] = [];
  let cur: { section: boolean; blocks: Block[] } | null = null;
  for (const b of blocks) {
    if (b.kind === 'rule') {
      cur = null;
      out.push('rule');
    } else if (b.kind === 'h2') {
      cur = { section: true, blocks: [b] };
      out.push(cur);
    } else {
      if (!cur) {
        cur = { section: false, blocks: [] };
        out.push(cur);
      }
      cur.blocks.push(b);
    }
  }
  return out;
}

export function TermsDocument({ blocks }: { blocks: Block[] }) {
  return (
    <div data-terms-body data-doc-id={TERMS_DOC_ID} data-doc-version={TERMS_DOC_VERSION} className="space-y-6 text-body-lg leading-7 text-muted">
      {groups(blocks).map((g, i) =>
        g === 'rule' ? (
          <hr key={i} className="border-line" />
        ) : g.section ? (
          <section key={i} className="space-y-4">
            {g.blocks.map((b, j) => <Piece key={j} block={b} />)}
          </section>
        ) : (
          <Fragment key={i}>
            {g.blocks.map((b, j) => <Piece key={j} block={b} />)}
          </Fragment>
        ),
      )}
    </div>
  );
}
