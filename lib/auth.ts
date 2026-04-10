import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export type AppRole = 'admin' | 'desk';

export type UserProfile = {
  id: string;
  email: string;
  role: AppRole;
  must_change_password: boolean;
};

export async function getCurrentUserProfile(): Promise<UserProfile | null> {
  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return null;
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id, email, role, must_change_password')
    .eq('id', user.id)
    .maybeSingle();

  if (profileError || !profile) {
    return null;
  }

  if (profile.role !== 'admin' && profile.role !== 'desk') {
    return null;
  }

  return {
    id: profile.id,
    email: profile.email,
    role: profile.role,
    must_change_password: profile.must_change_password,
  };
}

const BASE_URL =
  process.env.ADMIN_SITE_URL ||
  process.env.NEXT_PUBLIC_APP_URL ||
  'http://localhost:3000';

export function getRoleHome(role: string) {
  if (role === 'admin') {
    return `${BASE_URL}/admin`;
  }

  if (role === 'desk') {
    return `${BASE_URL}/desk`;
  }

  return '/login';
}

export async function requireRole(allowedRoles: AppRole[]) {
  const profile = await getCurrentUserProfile();

  if (!profile) {
    redirect('/unauthorized');
  }

  // 🔒 FORCE PASSWORD CHANGE (cannot bypass)
  if (profile.must_change_password) {
    redirect('/change-password');
  }

  if (!allowedRoles.includes(profile.role)) {
    redirect('/unauthorized');
  }

  return profile;
}