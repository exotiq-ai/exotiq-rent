import { NextResponse } from 'next/server';
import { renterCaptureEnabled } from '@/domain/renters/config';
import { handleCapture } from '@/domain/renters/capture';
import { validateCapture } from '@/domain/renters/validate';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_BODY = 16 * 1024;

/**
 * POST /api/renters/capture (MP-14). Records a renter and what they asked
 * for; sends the confirmation or the requested e-mail. Never returns store
 * internals; 503 when the host has no renter store configured.
 */
export async function POST(request: Request) {
  if (!renterCaptureEnabled()) return NextResponse.json({ error: 'Not available on this host.' }, { status: 503 });
  const raw = await request.text();
  if (raw.length > MAX_BODY) return NextResponse.json({ error: 'Too large.' }, { status: 413 });
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: 'Expected JSON.' }, { status: 400 });
  }
  const parsed = validateCapture(body);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const ip = request.headers.get('x-nf-client-connection-ip') ?? request.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? '';
  const userAgent = request.headers.get('user-agent') ?? '';
  try {
    const outcome = await handleCapture(parsed.value, { ip, userAgent });
    return NextResponse.json({ ok: true, status: outcome.status }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('[renters] capture failed', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Something went wrong. Try again in a moment.' }, { status: 500 });
  }
}
