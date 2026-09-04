import { NextResponse } from 'next/server';
import { siteUrl } from '@/domain/booking/config';
import { renterCaptureEnabled } from '@/domain/renters/config';
import { CaptureRefusedError, RateLimitedError, handleCapture } from '@/domain/renters/capture';
import { validateCapture } from '@/domain/renters/validate';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_BODY = 16 * 1024;
const NO_STORE = { 'Cache-Control': 'no-store' };

function sameOrigin(request: Request): boolean {
  // Only our own pages post here: a JSON body (a cross-site form cannot set
  // that type) from our origin. Fetch metadata is honoured when present.
  const type = (request.headers.get('content-type') ?? '').toLowerCase();
  if (!type.startsWith('application/json')) return false;
  const site = request.headers.get('sec-fetch-site');
  if (site && site !== 'same-origin' && site !== 'none') return false;
  const origin = request.headers.get('origin');
  if (origin) {
    const allowed = new Set([siteUrl(), new URL(request.url).origin]);
    if (!allowed.has(origin)) return false;
  }
  return true;
}

/**
 * POST /api/renters/capture (MP-14). Records a renter and what they asked
 * for; sends the confirmation or the requested e-mail. Never returns store
 * internals; 503 when the host has no renter store configured; 429 under
 * the per-connection / per-address limits.
 */
export async function POST(request: Request) {
  if (!renterCaptureEnabled()) return NextResponse.json({ error: 'E-mail signup is not available right now. Try again later or write to hello@exotiq.ai.' }, { status: 503, headers: NO_STORE });
  if (!sameOrigin(request)) return NextResponse.json({ error: 'Rejected.' }, { status: 403, headers: NO_STORE });
  const raw = await request.text();
  if (raw.length > MAX_BODY) return NextResponse.json({ error: 'Too large.' }, { status: 413, headers: NO_STORE });
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: 'Expected JSON.' }, { status: 400, headers: NO_STORE });
  }
  const parsed = validateCapture(body);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400, headers: NO_STORE });
  const ip = request.headers.get('x-nf-client-connection-ip') ?? request.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? '';
  const userAgent = request.headers.get('user-agent') ?? '';
  try {
    const outcome = await handleCapture(parsed.value, { ip, userAgent });
    return NextResponse.json({ ok: outcome.status !== 'mail_failed', status: outcome.status }, { status: outcome.status === 'mail_failed' ? 502 : 200, headers: NO_STORE });
  } catch (error) {
    if (error instanceof RateLimitedError) return NextResponse.json({ error: error.message }, { status: 429, headers: NO_STORE });
    if (error instanceof CaptureRefusedError) return NextResponse.json({ error: error.message }, { status: 400, headers: NO_STORE });
    console.error('[renters] capture failed', error instanceof Error ? error.message : 'error');
    return NextResponse.json({ error: 'Something went wrong. Try again in a moment.' }, { status: 500, headers: NO_STORE });
  }
}
