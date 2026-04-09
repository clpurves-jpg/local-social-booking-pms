'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';

export default function AdminGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const isLoggedIn = false; // temp until auth is wired

    // 🚨 CRITICAL FIX: do NOT redirect if already on /login
    if (!isLoggedIn && pathname !== '/login') {
      router.push('/login');
    }
  }, [pathname, router]);

  return <>{children}</>;
}