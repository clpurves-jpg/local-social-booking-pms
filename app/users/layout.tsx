import type { ReactNode } from 'react';
import { requireRole } from '@/lib/auth';

export default async function UsersLayout({
  children,
}: {
  children: ReactNode;
}) {
  await requireRole(['admin']);
  return <>{children}</>;
}