// MP-37 AC10: the wall page asks for nothing else: no script, no stylesheet link, no image, no
// external URL, no site asset, no web font. Its only link is the support mailto. It still carries
// lang, a title, a viewport, robots noindex and exactly one h1.
import { describe, expect, it } from 'vitest';
import { renderWallHtml } from '@/domain/maintenance/wall';

const FORBIDDEN: [string, RegExp][] = [
  ['script', /<script/i],
  ['link', /<link/i],
  ['img', /<img/i],
  ['iframe', /<iframe/i],
  ['object', /<object/i],
  ['form', /<form/i],
  ['@import', /@import/i],
  ['url(', /url\(/i],
  ['src=', /\ssrc\s*=/i],
  ['inline handler', /\son[a-z]+\s*=/i],
  ['http://', /http:\/\//i],
  ['https://', /https:\/\//i],
  ['web font', /@font-face|\.woff2?\b|fonts\.googleapis/i],
];

function selfContainedProblems(html: string): string[] {
  const p = FORBIDDEN.filter(([, re]) => re.test(html)).map(([name]) => name);
  const hrefs = Array.from(html.matchAll(/\shref\s*=\s*"([^"]*)"/gi), (m) => m[1]);
  if (JSON.stringify(hrefs) !== JSON.stringify(['mailto:support@exotiq.ai'])) p.push(`hrefs ${JSON.stringify(hrefs)}`);
  const styles = html.match(/<style[\s>]/gi)?.length ?? 0;
  if (styles !== 1) p.push(`${styles} style elements`);
  if (/\sstyle\s*=/i.test(html)) p.push('inline style attribute');
  return p;
}

function headProblems(html: string): string[] {
  const p: string[] = [];
  if (!/<html lang="en">/.test(html)) p.push('lang');
  const title = html.match(/<title>([^<]*)<\/title>/);
  if (!title || !title[1].trim()) p.push('title');
  if (!/<meta name="viewport" content="[^"]+">/.test(html)) p.push('viewport');
  if (!/<meta name="robots" content="noindex">/.test(html)) p.push('robots');
  const h1 = html.match(/<h1[\s>]/g)?.length ?? 0;
  if (h1 !== 1) p.push(`${h1} h1`);
  return p;
}

describe('MP-37 the wall page stands alone', () => {
  it('the wall page has no script, no external request and no site asset', () => {
    const html = renderWallHtml({ backBy: '' });
    const plant = (extra: string) => html.replace('</main>', `${extra}</main>`);
    expect(selfContainedProblems(plant('<script>1</script>'))).toEqual(['script']);
    expect(selfContainedProblems(html.replace('</head>', '<link rel=stylesheet href="/x.css"></head>'))).toEqual(['link', 'hrefs ["/x.css","mailto:support@exotiq.ai"]']);
    expect(selfContainedProblems(plant('<img alt="">'))).toEqual(['img']);
    expect(selfContainedProblems(html.replace('</style>', 'body{background:url(https://cdn.example/x.png)}</style>'))).toEqual(['url(', 'https://']);
    expect(selfContainedProblems(plant('<p onclick="x()">x</p>'))).toEqual(['inline handler']);
    expect(selfContainedProblems(plant('<a href="/exotiq">x</a>'))).toEqual(['hrefs ["mailto:support@exotiq.ai","/exotiq"]']);
    expect(selfContainedProblems(html.replace('</style>', "@font-face{font-family:X;src:local('X')}</style>"))).toEqual(['web font']);
    expect(selfContainedProblems(html)).toEqual([]);
    expect(selfContainedProblems(renderWallHtml({ backBy: 'nine thirty' }))).toEqual([]);
  });

  it('the wall page carries lang, title, viewport, robots noindex and one h1', () => {
    const html = renderWallHtml({ backBy: '' });
    expect(headProblems(html.replace('<meta name="robots" content="noindex">', ''))).toEqual(['robots']);
    expect(headProblems(html.replace('</main>', '<h1>again</h1></main>'))).toEqual(['2 h1']);
    expect(headProblems(html)).toEqual([]);
  });
});
