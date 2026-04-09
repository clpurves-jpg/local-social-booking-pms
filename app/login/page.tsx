import { redirect } from 'next/navigation';
import LoginForm from './LoginForm';
import { getCurrentUserProfile, getRoleHome } from '@/lib/auth';

type LoginPageProps = {
  searchParams?: Promise<{
    message?: string;
  }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const profile = await getCurrentUserProfile();

  if (profile) {
    redirect(getRoleHome(profile.role));
  }

  const params = searchParams ? await searchParams : undefined;
  const message = params?.message ?? '';

  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'grid',
        placeItems: 'center',
        background: '#f8fafc',
        padding: '24px',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '420px',
          background: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: '16px',
          padding: '28px',
          boxShadow: '0 10px 30px rgba(15, 23, 42, 0.08)',
        }}
      >
        <div style={{ marginBottom: '18px' }}>
          <h1
            style={{
              margin: 0,
              fontSize: '28px',
              lineHeight: 1.1,
              color: '#0f172a',
            }}
          >
            Rivers End Admin
          </h1>
          <p style={{ marginTop: '8px', color: '#475569' }}>
            Sign in to access the admin and front desk dashboard.
          </p>
        </div>

       <LoginForm />
      </div>
    </main>
  );
}