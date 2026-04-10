import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export default async function DeskLoginPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle();

    if (profile?.role === 'admin') {
      redirect('/admin');
    }

    if (profile?.role === 'desk') {
      redirect('/desk');
    }
  }

  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'grid',
        placeItems: 'center',
        background:
          'linear-gradient(180deg, #f8fafc 0%, #eef2ff 100%)',
        padding: '24px',
      }}
    >
      <section
        style={{
          width: '100%',
          maxWidth: '520px',
          background: '#ffffff',
          borderRadius: '24px',
          padding: '32px',
          boxShadow: '0 20px 50px rgba(15, 23, 42, 0.12)',
          border: '1px solid #e2e8f0',
        }}
      >
        <div style={{ marginBottom: '20px' }}>
          <p
            style={{
              margin: 0,
              fontSize: '12px',
              fontWeight: 800,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: '#64748b',
            }}
          >
            High Desert Lodge
          </p>

          <h1
            style={{
              margin: '10px 0 0 0',
              fontSize: '32px',
              lineHeight: 1.1,
              color: '#0f172a',
            }}
          >
            Front Desk Login
          </h1>

          <p
            style={{
              margin: '12px 0 0 0',
              color: '#475569',
              fontSize: '16px',
              lineHeight: 1.6,
            }}
          >
            Sign in to access front desk tools for bookings, check-ins,
            check-outs, housekeeping, and guest payments.
          </p>
        </div>

        <div
          style={{
            display: 'grid',
            gap: '12px',
            marginTop: '24px',
          }}
        >
          <Link
            href="/admin/login"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '100%',
              minHeight: '48px',
              borderRadius: '999px',
              background: '#0F3B5F',
              color: '#ffffff',
              textDecoration: 'none',
              fontWeight: 700,
              fontSize: '15px',
            }}
          >
            Continue to Secure Login
          </Link>

          <Link
            href="/"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '100%',
              minHeight: '46px',
              borderRadius: '999px',
              background: '#ffffff',
              color: '#334155',
              textDecoration: 'none',
              fontWeight: 700,
              fontSize: '15px',
              border: '1px solid #cbd5e1',
            }}
          >
            Back to Site
          </Link>
        </div>

        <div
          style={{
            marginTop: '22px',
            paddingTop: '18px',
            borderTop: '1px solid #e2e8f0',
            color: '#64748b',
            fontSize: '13px',
            lineHeight: 1.6,
          }}
        >
          Desk users will be sent to the front desk dashboard after sign-in.
          Admin users will be sent to the admin dashboard.
        </div>
      </section>
    </main>
  );
}