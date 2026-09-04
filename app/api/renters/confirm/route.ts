import { NextResponse } from 'next/server';
import { renterCaptureEnabled } from '@/domain/renters/config';
import { confirmByToken } from '@/domain/renters/capture';
import { looksLikeToken } from '@/domain/renters/tokens';
import { siteUrl } from '@/domain/booking/config';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** GET /api/renters/confirm?token= — the link in the confirmation e-mail. Always redirects to a page; never renders JSON to a person. */
export async function GET(request: Request) {
  const base = siteUrl();
  if (!renterCaptureEnabled()) return NextResponse.redirect(`${base}/renters/confirmed?state=unavailable`, 302);
  const token = new URL(request.url).searchParams.get('token');
  if (!looksLikeToken(token)) return NextResponse.redirect(`${base}/renters/confirmed?state=invalid`, 302);
  try {
    const outcome = await confirmByToken(token);
    if (!outcome.ok) return NextResponse.redirect(`${base}/renters/confirmed?state=invalid`, 302);
    return NextResponse.redirect(`${base}/renters/confirmed?state=ok&sent=${outcome.delivered}`, 302);
  } catch (error) {
    console.error('[renters] confirm failed', error instanceof Error ? error.message : error);
    return NextResponse.redirect(`${base}/renters/confirmed?state=error`, 302);
  }
}
