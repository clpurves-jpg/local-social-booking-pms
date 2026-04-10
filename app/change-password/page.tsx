'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';

export default function ChangePasswordPage() {
  const supabase = createClient();
  const router = useRouter();

  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleChangePassword = async () => {
    setLoading(true);
    setError('');

    const { error: authError } = await supabase.auth.updateUser({
      password,
    });

    if (authError) {
      setError(authError.message);
      setLoading(false);
      return;
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setError('User not found');
      setLoading(false);
      return;
    }

    const { error: profileError } = await supabase
      .from('profiles')
      .update({ must_change_password: false })
      .eq('id', user.id);

    if (profileError) {
      setError(profileError.message);
      setLoading(false);
      return;
    }

    router.push('/admin'); // or desk fallback later
  };

  return (
    <main style={{ padding: 40 }}>
      <h1>Change Your Password</h1>

      <input
        type="password"
        placeholder="New password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        style={{ display: 'block', marginBottom: 12 }}
      />

      <button onClick={handleChangePassword} disabled={loading}>
        {loading ? 'Updating...' : 'Update Password'}
      </button>

      {error && <p style={{ color: 'red' }}>{error}</p>}
    </main>
  );
}