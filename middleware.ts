import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import createIntlMiddleware from 'next-intl/middleware';
import { locales, defaultLocale } from './i18n/config';
import { rateLimit } from './lib/rate-limit';

const intlMiddleware = createIntlMiddleware({
  locales,
  defaultLocale,
  localeDetection: true,
});

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip sitemap routes (no locale)
  if (pathname.startsWith('/sitemap') || pathname === '/robots.txt') {
    return NextResponse.next();
  }

  // API routes: apply rate limiting only (no locale)
  if (pathname.startsWith('/api/')) {
    // Skip health check endpoint
    if (pathname === '/api/health') {
      return NextResponse.next();
    }

    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      || request.headers.get('x-real-ip')
      || 'unknown';

    const { success } = await rateLimit(ip);

    if (!success) {
      return NextResponse.json(
        { error: 'Too many requests. Please try again later.' },
        {
          status: 429,
          headers: {
            'Retry-After': '60',
          },
        }
      );
    }

    return NextResponse.next();
  }

  // All other routes: apply i18n middleware
  return intlMiddleware(request);
}

export const config = {
  matcher: [
    // Match all paths except static files and api
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
};
