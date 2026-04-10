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

  // Let these route groups work normally
  if (
    pathname === '/' ||
    pathname === '/login' ||
    pathname.startsWith('/login/') ||
    pathname === '/change-password' ||
    pathname.startsWith('/change-password/') ||
    pathname === '/book' ||
    pathname.startsWith('/book/') ||
    pathname === '/admin' ||
    pathname.startsWith('/admin/') ||
    pathname === '/desk' ||
    pathname.startsWith('/desk/')
  ) {
    return sessionResponse;
  }

  // Policy and legal pages should be shown under /book for this demo app
  if (
    pathname === '/terms' ||
    pathname === '/privacy' ||
    pathname === '/pet-policy'
  ) {
    const url = request.nextUrl.clone();
    url.pathname = `/book${pathname}`;
    url.search = search;

    return copyCookies(sessionResponse, NextResponse.rewrite(url));
  }

  return sessionResponse;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};