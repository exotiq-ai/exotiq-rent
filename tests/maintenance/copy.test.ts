// MP-37 AC9: the wall says exactly the agreed sentences in the agreed order, promises no time,
// spells the brand Exotiq or exotiq, and adds a back-by sentence only for a short, plain value,
// escaped, never truncated.
import { describe, expect, it } from 'vitest';
import { backByText, buildWallResponse, renderWallHtml } from '@/domain/maintenance/wall';
import { makeRequest, scrubWallEnv, visibleBlocks, WALL_JSON } from './helpers';

// The suite must not depend on wall variables exported in the caller's shell.
scrubWallEnv();

const HEADING = 'Booking is paused for maintenance';
const BODY = 'We are doing planned maintenance on Exotiq booking. You cannot book, pay or change a reservation right now. Please come back a little later.';
const PAID = 'If you have just paid, please do not pay again. We will confirm your booking by email.';
const HELP = 'Need help with a current rental? Write to support@exotiq.ai.';
const AGREED = ['exotiq', HEADING, BODY, PAID, HELP];

const TIME_WORDS = /\b(minutes?|hours?|days?|tonight|tomorrow|today|soon|shortly|am|pm)\b/i;

function timeProblems(html: string): string[] {
  const text = visibleBlocks(html).join('\n');
  const p: string[] = [];
  if (/[0-9]/.test(text)) p.push(`digit in ${JSON.stringify(text.match(/[^\n]*[0-9][^\n]*/)?.[0])}`);
  const w = text.match(TIME_WORDS);
  if (w) p.push(`time word ${w[0]}`);
  return p;
}

/** Every case-insensitive exotiq is Exotiq or exotiq. */
function brandProblems(text: string): string[] {
  return Array.from(text.matchAll(/exotiq/gi), (m) => m[0]).filter((m) => m !== 'Exotiq' && m !== 'exotiq').map((m) => `brand written ${m}`);
}

describe('MP-37 the wall copy', () => {
  it('the default copy is exactly the agreed sentences', () => {
    const html = renderWallHtml({ backBy: '' });
    expect(visibleBlocks(html)).toEqual(AGREED);
    expect(html).toContain(`<title>${HEADING}</title>`);
    expect(html).toContain('<a href="mailto:support@exotiq.ai">support@exotiq.ai</a>');
    // The default response carries the default page.
    expect(renderWallHtml()).toBe(html);
    console.log(`default visible text:\n${visibleBlocks(html).join('\n')}`);
  });

  it('no digit or time word appears in the default copy', () => {
    // Planted: a promise of a time is reported.
    const planted = renderWallHtml({ backBy: '' }).replace(PAID, 'We will be back in 30 minutes.');
    expect(timeProblems(planted)).toEqual(['digit in "We will be back in 30 minutes."', 'time word minutes']);
    expect(timeProblems(renderWallHtml({ backBy: '' }))).toEqual([]);
  });

  it('the brand is never written with mixed capitals', async () => {
    const planted = renderWallHtml({ backBy: '' }).replace('Exotiq booking', ['Exot', 'IQ booking'].join(''));
    expect(brandProblems(planted)).toEqual([`brand written ${['Exot', 'IQ'].join('')}`]);
    const html = renderWallHtml({ backBy: '' });
    expect(brandProblems(html)).toEqual([]);
    expect(brandProblems(WALL_JSON)).toEqual([]);
    const json = await buildWallResponse(makeRequest('GET', '/api/renters/capture')).text();
    expect(brandProblems(json)).toEqual([]);
    // The wordmark is text, not an image.
    expect(visibleBlocks(html)[0]).toBe('exotiq');
    expect(html).not.toMatch(/<img|<svg/i);
  });

  it('back-by text appears once, escaped, only when set and at most 60 characters', async () => {
    const dflt = renderWallHtml({ backBy: '' });
    const plain = renderWallHtml({ backBy: backByText(' nine thirty ') });
    expect(visibleBlocks(plain)).toEqual(['exotiq', HEADING, BODY, 'We expect to be back by nine thirty.', PAID, HELP]);

    const raw = '<b>5 & 6</b>';
    const escaped = renderWallHtml({ backBy: backByText(raw) });
    expect(visibleBlocks(escaped)).toEqual(['exotiq', HEADING, BODY, `We expect to be back by ${raw}.`, PAID, HELP]);
    expect(escaped).not.toContain('<b>');
    expect(escaped).toContain('&lt;b&gt;5 &amp; 6&lt;/b&gt;');
    expect(renderWallHtml({ backBy: `"quoted" 'single'` })).toContain('&quot;quoted&quot; &#39;single&#39;');

    const sixty = 'a'.repeat(60);
    expect(backByText(sixty)).toBe(sixty);
    for (const ignored of ['a'.repeat(61), '', '   ', 'nine\nthirty', 'nine\tthirty', undefined]) {
      expect(backByText(ignored), JSON.stringify(ignored)).toBe('');
      expect(renderWallHtml({ backBy: backByText(ignored) }), JSON.stringify(ignored)).toBe(dflt);
    }
    // Through the response, from the raw value, the same rules hold.
    const res = buildWallResponse(makeRequest('GET', '/'), { backBy: raw });
    expect(await res.text()).toBe(escaped);
    const long = buildWallResponse(makeRequest('GET', '/'), { backBy: 'a'.repeat(61) });
    expect(await long.text()).toBe(dflt);
    console.log(`back-by case (${JSON.stringify(raw)}):\n${visibleBlocks(escaped).join('\n')}`);
  });
});
