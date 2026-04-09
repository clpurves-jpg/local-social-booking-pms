import { type EmailOtpType } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

function redirectTo(request: NextRequest, path: string) {
  return NextResponse.redirect(new URL(path, request.url));
}

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const token_hash = requestUrl.searchParams.get('token_hash');
  const type = requestUrl.searchParams.get('type') as EmailOtpType | null;
  const error_code = requestUrl.searchParams.get('error_code');

  const supabase = await createClient();

  if (error_code) {
    return redirectTo(request, '/login?message=Magic%20link%20expired%20or%20invalid');
  }

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      return redirectTo(request, '/login?message=Unable%20to%20sign%20in');
    }
  } else if (token_hash && type) {
    const { error } = await supabase.auth.verifyOtp({
      token_hash,
      type,
    });

    if (error) {
      return redirectTo(request, '/login?message=Invalid%20or%20expired%20link');
    }
  } else {
    return redirectTo(request, '/login?message=Missing%20login%20token');
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return redirectTo(request, '/login?message=No%20user%20session');
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();

  if (profileError || !profile) {
    await supabase.auth.signOut();
    return redirectTo(request, '/login?message=No%20profile%20found');
  }

  if (profile.role === 'admin') {
    return redirectTo(request, '/admin/bookings');
  }

  if (profile.role === 'desk') {
    return redirectTo(request, '/desk/bookings');
  }

  await supabase.auth.signOut();
  return redirectTo(request, '/login?message=No%20access%20role%20assigned');
}