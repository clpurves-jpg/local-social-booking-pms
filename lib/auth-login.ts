'use server';

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

type LoginResult = {
  error?: string;
};

const ADMIN_SITE_URL =
  process.env.ADMIN_SITE_URL ||
  process.env.NEXT_PUBLIC_APP_URL ||
  'http://localhost:3000';

export async function loginAndRedirect(
  email: string,
  password: string
): Promise<LoginResult> {
  const supabase = await createClient();

  const { data: authData, error: authError } =
    await supabase.auth.signInWithPassword({
      email,
      password,
    });

  if (authError || !authData.user) {
    return { error: 'Invalid email or password.' };
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', authData.user.id)
    .single();

  if (profileError || !profile) {
    return { error: 'Profile not found for this user.' };
  }

  if (profile.role === 'admin') {
    redirect(`${ADMIN_SITE_URL}/admin`);
  }

  if (profile.role === 'desk') {
    redirect(`${ADMIN_SITE_URL}/desk`);
  }

  return { error: 'This account does not have a valid role.' };
}