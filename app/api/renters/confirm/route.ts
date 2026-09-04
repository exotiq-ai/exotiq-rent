import { NextResponse } from 'next/server';
import { renterCaptureEnabled } from '@/domain/renters/config';
import { confirmByToken } from '@/domain/renters/capture';
import { looksLikeToken } from '@/domain/renters/tokens';
import { siteUrl } from '@/domain/booking/config';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * The link in the confirmation e-mail. GET is side-effect free — it lands on
 * a page with one button — because mail scanners follow every link in a
 * message. The click POSTs the token here and only then is anything written.
 */
export async function GET(request: Request) {
  const base = siteUrl();
  const token = new URL(request.url).searchParams.get('token');
  if (!renterCaptureEnabled()) return NextResponse.redirect(`${base}/renters/confirmed?state=unavailable`, 302);
  if (!looksLikeToken(token)) return NextResponse.redirect(`${base}/renters/confirmed?state=invalid`, 302);
  return NextResponse.redirect(`${base}/renters/confirm?token=${encodeURIComponent(token)}`, 302);
}

export async function POST(request: Request) {
  const base = siteUrl();
  if (!renterCaptureEnabled()) return NextResponse.redirect(`${base}/renters/confirmed?state=unavailable`, 303);
  const form = await request.formData().catch(() => null);
  const token = form?.get('token');
  if (!looksLikeToken(token)) return NextResponse.redirect(`${base}/renters/confirmed?state=invalid`, 303);
  try {
    const outcome = await confirmByToken(token);
    if (!outcome.ok) return NextResponse.redirect(`${base}/renters/confirmed?state=invalid`, 303);
    return NextResponse.redirect(`${base}/renters/confirmed?state=ok&sent=${outcome.delivered}&marketing=${outcome.marketing ? '1' : '0'}`, 303);
  } catch (error) {
    console.error('[renters] confirm failed', error instanceof Error ? error.message : 'error');
    return NextResponse.redirect(`${base}/renters/confirmed?state=error`, 303);
  }
}
