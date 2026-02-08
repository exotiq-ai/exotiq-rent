import { NextRequest, NextResponse } from 'next/server';

/**
 * Password gate middleware for exotiq.rent
 * 
 * Protects all routes behind a simple password.
 * Set SITE_PASSWORD in your environment variables (.env.local or Vercel dashboard).
 * 
 * Authenticated sessions are tracked via a cookie that lasts 7 days.
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow the gate page and its API route through
  if (pathname === '/gate' || pathname === '/api/auth') {
    return NextResponse.next();
  }

  // Allow static assets and Next.js internals through
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/fonts') ||
    pathname.startsWith('/images') ||
    pathname.startsWith('/favicon') ||
    pathname.endsWith('.ico') ||
    pathname.endsWith('.png') ||
    pathname.endsWith('.jpg') ||
    pathname.endsWith('.svg') ||
    pathname.endsWith('.woff') ||
    pathname.endsWith('.woff2')
  ) {
    return NextResponse.next();
  }

  // Check for auth cookie
  const authCookie = request.cookies.get('exotiq_auth');
  if (authCookie?.value === 'authenticated') {
    return NextResponse.next();
  }

  // Redirect to gate
  const gateUrl = new URL('/gate', request.url);
  gateUrl.searchParams.set('redirect', pathname);
  return NextResponse.redirect(gateUrl);
}

export const config = {
  matcher: ['/((?!_next/static|_next/image).*)'],
};
