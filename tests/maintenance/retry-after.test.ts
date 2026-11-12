// MP-37 AC8: Retry-After is 1800 unless MAINTENANCE_RETRY_AFTER, trimmed, is a plain integer from
// 60 to 86400. Anything else falls back to 1800; the header is never an HTTP-date and never an
// error, and it is the same on every method and path class.
import { describe, expect, it } from 'vitest';
import { buildWallResponse, retryAfterSeconds } from '@/domain/maintenance/wall';
import { makeRequest, matrix } from './helpers';

const ACCEPTED: [string | undefined, number][] = [
  [undefined, 1800],
  ['60', 60],
  ['900', 900],
  ['3600', 3600],
  ['86400', 86400],
  [' 900 ', 900],
  ['0900', 900],
];
const REJECTED: string[] = ['', '59', '86401', '0', '-5', 'abc', '900.5', '1e3', '9 00', '+900', '9'.repeat(400)];

const table: string[] = [];
const show = (v: string | undefined) => (v === undefined ? 'unset' : v.length > 20 ? `<${v.length} characters>` : JSON.stringify(v));

describe('MP-37 Retry-After', () => {
  it('Retry-After defaults to 1800 and accepts an integer from 60 to 86400', () => {
    for (const [raw, want] of ACCEPTED) {
      expect(retryAfterSeconds(raw), show(raw)).toBe(want);
      const res = buildWallResponse(makeRequest('GET', '/exotiq'), { retryAfter: raw });
      expect(res.headers.get('retry-after'), show(raw)).toBe(String(want));
      table.push(`${show(raw)} -> ${res.headers.get('retry-after')}`);
    }
    // Same header on every method and path class.
    const seen = new Set(matrix().map((m) => buildWallResponse(makeRequest(m.method, m.path, m.headers), { retryAfter: '900' }).headers.get('retry-after')));
    expect(Array.from(seen)).toEqual(['900']);
    const dflt = new Set(matrix().map((m) => buildWallResponse(makeRequest(m.method, m.path, m.headers)).headers.get('retry-after')));
    expect(Array.from(dflt)).toEqual(['1800']);
  });

  it('invalid Retry-After values fall back to 1800', () => {
    // Planted: a lenient parser (parseInt) would accept several of these; the test pins each one.
    const lenient = (v: string) => { const n = parseInt(v, 10); return n >= 60 && n <= 86400 ? n : 1800; };
    expect(REJECTED.filter((v) => lenient(v) !== 1800).length).toBeGreaterThan(0);
    for (const raw of REJECTED) {
      let value: number | undefined;
      expect(() => { value = retryAfterSeconds(raw); }, show(raw)).not.toThrow();
      expect(value, show(raw)).toBe(1800);
      const header = buildWallResponse(makeRequest('GET', '/'), { retryAfter: raw }).headers.get('retry-after');
      expect(header, show(raw)).toBe('1800');
      expect(header).toMatch(/^[0-9]+$/);
      table.push(`${show(raw)} -> ${header}`);
    }
    console.log(`Retry-After value table:\n${table.join('\n')}`);
  });
});
