import { NextResponse } from 'next/server';
import { renterCaptureEnabled } from '@/domain/renters/config';
import { unsubscribeByToken } from '@/domain/renters/capture';
import { siteUrl } from '@/domain/booking/config';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TOKEN = /^[A-Za-z0-9_-]{40,48}$/;

/** The footer link in every e-mail. GET only shows the page; the write happens on POST (a button, or RFC 8058 one-click from the mail client). */
export async function GET(request: Request) {
  const base = siteUrl();
  const params = new URL(request.url).searchParams;
  const renterId = params.get('r') ?? '';
  const token = params.get('token') ?? '';
  if (!renterCaptureEnabled()) return NextResponse.redirect(`${base}/renters/unsubscribed?state=unavailable`, 302);
  if (!UUID.test(renterId) || !TOKEN.test(token)) return NextResponse.redirect(`${base}/renters/unsubscribed?state=invalid`, 302);
  return NextResponse.redirect(`${base}/renters/unsubscribe?r=${renterId}&token=${encodeURIComponent(token)}`, 302);
}

export async function POST(request: Request) {
  const base = siteUrl();
  if (!renterCaptureEnabled()) return NextResponse.redirect(`${base}/renters/unsubscribed?state=unavailable`, 303);
  // The button posts r + token in the body; a mail client's one-click POST
  // carries them in the URL with the RFC 8058 body.
  const url = new URL(request.url);
  const form = await request.formData().catch(() => null);
  const renterId = String(form?.get('r') ?? url.searchParams.get('r') ?? '');
  const token = String(form?.get('token') ?? url.searchParams.get('token') ?? '');
  if (!UUID.test(renterId) || !TOKEN.test(token)) return NextResponse.redirect(`${base}/renters/unsubscribed?state=invalid`, 303);
  try {
    const ok = await unsubscribeByToken(renterId, token);
    return NextResponse.redirect(`${base}/renters/unsubscribed?state=${ok ? 'ok' : 'invalid'}`, 303);
  } catch (error) {
    console.error('[renters] unsubscribe failed', error instanceof Error ? error.message : 'error');
    return NextResponse.redirect(`${base}/renters/unsubscribed?state=error`, 303);
  }
}
