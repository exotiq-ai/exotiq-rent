import { NextResponse } from 'next/server';
import { renterCaptureEnabled } from '@/domain/renters/config';
import { unsubscribeByToken } from '@/domain/renters/capture';
import { siteUrl } from '@/domain/booking/config';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** GET /api/renters/unsubscribe?r=<renter id>&token= — the footer link in every e-mail. */
export async function GET(request: Request) {
  const base = siteUrl();
  if (!renterCaptureEnabled()) return NextResponse.redirect(`${base}/renters/unsubscribed?state=unavailable`, 302);
  const params = new URL(request.url).searchParams;
  const renterId = params.get('r') ?? '';
  const token = params.get('token') ?? '';
  if (!UUID.test(renterId) || !/^[A-Za-z0-9_-]{40,48}$/.test(token)) return NextResponse.redirect(`${base}/renters/unsubscribed?state=invalid`, 302);
  try {
    const ok = await unsubscribeByToken(renterId, token);
    return NextResponse.redirect(`${base}/renters/unsubscribed?state=${ok ? 'ok' : 'invalid'}`, 302);
  } catch (error) {
    console.error('[renters] unsubscribe failed', error instanceof Error ? error.message : error);
    return NextResponse.redirect(`${base}/renters/unsubscribed?state=error`, 302);
  }
}
