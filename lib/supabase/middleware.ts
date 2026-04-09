import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookieOptions: {
        name: 'riversend-auth',
        domain: '.riversendstay.com',
        path: '/',
        sameSite: 'lax',
        secure: true,
      },
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          });

          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, {
              ...options,
              domain: '.riversendstay.com',
              path: '/',
              sameSite: 'lax',
              secure: true,
            });
          }
        },
      },
    }
  );

  await supabase.auth.getUser();

  return response;
}