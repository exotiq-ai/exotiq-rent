/**
 * Maintenance wall (MP-37): the response every request gets while a wall build is published.
 *
 * Pure and edge-safe: global Response and Headers only, no Node API, no app imports. The request
 * is only looked at for its path and its Accept header; its body is never read and nothing from
 * it is written into the response.
 *
 * The two optional values are read as plain process.env names so that next.config.js `env` inlines
 * them into the middleware bundle of a wall build (and nowhere else). Tests pass them as options.
 */

/** The four tone values the page uses; tests/maintenance/contrast.test.ts holds them equal to tone. */
export const WALL_COLOURS = { ground: '#06070a', ink: '#F4F6F9', muted: '#E1E4EA', gold: '#C8A664' } as const;

export const DEFAULT_RETRY_AFTER = 1800;
export const WALL_HEADING = 'Booking is paused for maintenance';
export const WALL_CSP = "default-src 'none'; style-src 'unsafe-inline'; img-src data:; frame-ancestors 'none'";
export const WALL_JSON = '{"error":"Booking is paused for maintenance. Please try again later.","maintenance":true}';

/** Seconds for Retry-After: a plain integer from 60 to 86400 after trimming, else 1800. */
export function retryAfterSeconds(raw?: string | null): number {
  const t = typeof raw === 'string' ? raw.trim() : '';
  if (!/^[0-9]+$/.test(t)) return DEFAULT_RETRY_AFTER;
  const n = Number(t);
  return n >= 60 && n <= 86400 ? n : DEFAULT_RETRY_AFTER;
}

/** The back-by text: 1 to 60 characters after trimming, no control character; else '' (never cut short). */
export function backByText(raw?: string | null): string {
  const t = typeof raw === 'string' ? raw.trim() : '';
  if (t.length < 1 || t.length > 60) return '';
  return /[\u0000-\u001f\u007f]/.test(t) ? '' : t;
}

const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

const { ground, ink, muted, gold } = WALL_COLOURS;
const STYLE = [
  `html{background:${ground}}`,
  `body{margin:0;background:${ground};color:${muted};font-family:system-ui,-apple-system,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif;font-size:1rem;line-height:1.6}`,
  'main{box-sizing:border-box;max-width:36rem;margin:0 auto;padding:4rem 1.5rem;overflow-wrap:anywhere}',
  `.mark{color:${gold};font-size:1.125rem;font-weight:600;letter-spacing:.04em;margin:0 0 2rem}`,
  `h1{color:${ink};font-size:1.75rem;line-height:1.25;font-weight:600;margin:0 0 1.25rem}`,
  'p{font-size:1rem;margin:0 0 1rem}',
  `a{color:${gold};text-decoration:underline}`,
].join('');

/** The wall document. `backBy` is shown only when backByText() accepts it. */
export function renderWallHtml(options: { backBy?: string } = {}): string {
  const backBy = backByText(options.backBy);
  return [
    '<!doctype html>',
    '<html lang="en">',
    '<head>',
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    '<meta name="robots" content="noindex">',
    `<title>${WALL_HEADING}</title>`,
    `<style>${STYLE}</style>`,
    '</head>',
    '<body>',
    '<main>',
    '<p class="mark">exotiq</p>',
    `<h1>${WALL_HEADING}</h1>`,
    '<p>We are doing planned maintenance on Exotiq booking. You cannot book, pay or change a reservation right now. Please come back a little later.</p>',
    ...(backBy ? [`<p>We expect to be back by ${escapeHtml(backBy)}.</p>`] : []),
    '<p>If you have just paid, please do not pay again. We will confirm your booking by email.</p>',
    '<p>Need help with a current rental? Write to <a href="mailto:support@exotiq.ai">support@exotiq.ai</a>.</p>',
    '</main>',
    '</body>',
    '</html>',
    '',
  ].join('\n');
}

export type WallOptions = { retryAfter?: string; backBy?: string };

/**
 * 503 for every request. API paths get the JSON body unless the caller asks for HTML (a link
 * clicked in an e-mail does); everything else gets the document. HEAD gets the headers only.
 */
export function buildWallResponse(request: Request, options: WallOptions = {}): Response {
  const retryAfter = retryAfterSeconds(options.retryAfter ?? process.env.MAINTENANCE_RETRY_AFTER);
  const backBy = options.backBy ?? process.env.MAINTENANCE_BACK_BY;
  const pathname = new URL(request.url).pathname;
  const isApi = pathname === '/api' || pathname.startsWith('/api/');
  const wantsHtml = (request.headers.get('accept') ?? '').toLowerCase().includes('text/html');
  const json = isApi && !wantsHtml;

  const headers = new Headers({
    'Retry-After': String(retryAfter),
    'Cache-Control': 'no-store',
    'X-Robots-Tag': 'noindex',
    'X-Exotiq-Maintenance': 'on',
    'Content-Security-Policy': WALL_CSP,
    'Content-Type': json ? 'application/json' : 'text/html; charset=utf-8',
    Vary: 'Accept',
  });
  if (request.method === 'HEAD') return new Response(null, { status: 503, headers });
  return new Response(json ? WALL_JSON : renderWallHtml({ backBy }), { status: 503, headers });
}
