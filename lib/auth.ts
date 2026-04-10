import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export type AppRole = 'admin' | 'desk';

export type UserProfile = {
  id: string;
  email: string;
  role: AppRole;
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
    .select('id, email, role')
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
  };
}

const ADMIN_SITE_URL =
  process.env.ADMIN_SITE_URL ||
  process.env.NEXT_PUBLIC_APP_URL ||
  'http://localhost:3000';

export function getRoleHome(role: string) {
  if (role === 'admin') {
    return `${ADMIN_SITE_URL}/admin`;
  }

  if (role === 'desk') {
    return `${ADMIN_SITE_URL}/desk`;
  }

  return '/login';
}

export async function requireRole(allowedRoles: AppRole[]) {
  const profile = await getCurrentUserProfile();

  if (!profile) {
    redirect('/unauthorized');
  }

  if (!allowedRoles.includes(profile.role)) {
    redirect('/unauthorized');
  }

  return profile;
}