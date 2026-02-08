import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { password } = await request.json();

    // Default password for initial setup — override via SITE_PASSWORD env var
    const sitePassword = process.env.SITE_PASSWORD || 'exotiq2026';

    if (password === sitePassword) {
      const response = NextResponse.json({ success: true });

      // Set auth cookie — 7 day expiry
      response.cookies.set('exotiq_auth', 'authenticated', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 7, // 7 days
        path: '/',
      });

      return response;
    }

    return NextResponse.json({ error: 'Invalid password' }, { status: 401 });
  } catch {
    return NextResponse.json({ error: 'Bad request' }, { status: 400 });
  }
}
