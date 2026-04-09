import { NextRequest, NextResponse } from 'next/server';
import { updateSession } from './lib/supabase/middleware';

function copyCookies(from: NextResponse, to: NextResponse) {
  for (const cookie of from.cookies.getAll()) {
    to.cookies.set(cookie);
  }
  return to;
}

export async function middleware(request: NextRequest) {
  const sessionResponse = await updateSession(request);

  const hostname = request.nextUrl.hostname.toLowerCase();
  const { pathname, search } = request.nextUrl;

  // Skip internals, API, and files
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname === '/favicon.ico' ||
    pathname === '/robots.txt' ||
    pathname === '/sitemap.xml' ||
    /\.[a-zA-Z0-9]+$/.test(pathname)
  ) {
    return sessionResponse;
  }

  // Allow /desk to stay /desk on any hostname
  if (pathname === '/desk' || pathname.startsWith('/desk/')) {
    return sessionResponse;
  }

  // ADMIN DOMAIN -> /admin
  if (hostname === 'admin.riversendstay.com') {
    if (pathname === '/admin' || pathname.startsWith('/admin/')) {
      return sessionResponse;
    }

    const url = request.nextUrl.clone();
    url.pathname = pathname === '/' ? '/admin' : `/admin${pathname}`;
    url.search = search;

    return copyCookies(sessionResponse, NextResponse.rewrite(url));
  }

  // BOOK DOMAIN -> /book
  if (hostname === 'book.riversendstay.com') {
    if (pathname === '/book' || pathname.startsWith('/book/')) {
      return sessionResponse;
    }

    const url = request.nextUrl.clone();
    url.pathname = pathname === '/' ? '/book' : `/book${pathname}`;
    url.search = search;

    return copyCookies(sessionResponse, NextResponse.rewrite(url));
  }

  return sessionResponse;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};