import type { ReactNode } from 'react';
import Link from 'next/link';
import { requireRole } from '@/lib/auth';

export default async function AdminLayout({
  children,
}: {
  children: ReactNode;
}) {
  const profile = await requireRole(['admin', 'desk']);
  const isAdmin = profile.role === 'admin';

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#f8fafc',
        color: '#0f172a',
      }}
    >
      <header
        style={{
          borderBottom: '1px solid #e2e8f0',
          background: '#ffffff',
          padding: '16px 20px',
        }}
      >
        <div
          style={{
            maxWidth: '1200px',
            margin: '0 auto',
            display: 'flex',
            gap: '12px',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <strong>Rivers End Lodging</strong>
            <div style={{ fontSize: '14px', color: '#64748b' }}>
              Signed in as {profile.email} · {profile.role}
            </div>
          </div>

          <nav style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            {/* ADMIN ONLY */}
            {isAdmin && (
              <>
                <Link href="/admin">Dashboard</Link>
                <Link href="/admin/bookings">Bookings</Link>
                <Link href="/admin/calendar">Calendar</Link>
                <Link href="/admin/reports">Reports</Link>
                <Link href="/admin/rooms">Rooms</Link>
                <Link href="/admin/staff">Staff</Link>
              </>
            )}

            {/* SHARED / DESK ACCESS */}
            <Link href="/desk">Desk</Link>
            <Link href="/desk/housekeeping">Housekeeping</Link>
            <Link href="/desk/training">Training</Link>

            {/* LOGOUT */}
            <a href="/api/logout">Logout</a>
          </nav>
        </div>
      </header>

      <main style={{ maxWidth: '1200px', margin: '0 auto', padding: '24px' }}>
        {children}
      </main>
    </div>
  );
}