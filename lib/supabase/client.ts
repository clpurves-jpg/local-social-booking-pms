import { createBrowserClient } from '@supabase/ssr';

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      isSingleton: true,
      cookieOptions: {
        name: 'riversend-auth',
        domain: '.riversendstay.com',
        path: '/',
        sameSite: 'lax',
        secure: true,
      },
    }
  );
}