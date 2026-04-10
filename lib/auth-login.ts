'use server';

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

type LoginResult = {
  error?: string;
};

const BASE_URL =
  process.env.ADMIN_SITE_URL ||
  process.env.NEXT_PUBLIC_APP_URL ||
  'http://localhost:3000';

export async function loginAndRedirect(
  email: string,
  password: string
): Promise<LoginResult> {
  const supabase = await createClient();

  // 🔐 Sign in
  const { data: authData, error: authError } =
    await supabase.auth.signInWithPassword({
      email,
      password,
    });

  if (authError || !authData.user) {
    return { error: 'Invalid email or password.' };
  }

  // 👤 Get profile (NOW includes must_change_password)
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role, must_change_password')
    .eq('id', authData.user.id)
    .single();

  if (profileError || !profile) {
    return { error: 'Profile not found for this user.' };
  }

  // 🔒 FORCE PASSWORD CHANGE FIRST
  if (profile.must_change_password) {
    redirect(`${BASE_URL}/change-password`);
  }

  // 🚀 Normal role routing
  if (profile.role === 'admin') {
    redirect(`${BASE_URL}/admin`);
  }

  if (profile.role === 'desk') {
    redirect(`${BASE_URL}/desk`);
  }

  return { error: 'This account does not have a valid role.' };
}