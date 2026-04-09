'use client';

import { useState, useTransition } from 'react';
import { loginAndRedirect } from '@/lib/auth-login';

export default function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError('');

    startTransition(async () => {
      const result = await loginAndRedirect(email, password);
      if (result?.error) {
        setError(result.error);
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} style={{ width: '100%' }}>
      <div style={{ marginBottom: '16px' }}>
        <label
          htmlFor="email"
          style={{ display: 'block', marginBottom: '6px', fontWeight: 600 }}
        >
          Email
        </label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          style={{
            width: '100%',
            padding: '12px',
            borderRadius: '10px',
            border: '1px solid #cbd5e1',
          }}
        />
      </div>

      <div style={{ marginBottom: '16px' }}>
        <label
          htmlFor="password"
          style={{ display: 'block', marginBottom: '6px', fontWeight: 600 }}
        >
          Password
        </label>
        <input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          style={{
            width: '100%',
            padding: '12px',
            borderRadius: '10px',
            border: '1px solid #cbd5e1',
          }}
        />
      </div>

      {error ? (
        <div
          style={{
            marginBottom: '16px',
            padding: '12px',
            borderRadius: '10px',
            background: '#fef2f2',
            color: '#b91c1c',
            border: '1px solid #fecaca',
          }}
        >
          {error}
        </div>
      ) : null}

      <button
        type="submit"
        disabled={isPending}
        style={{
          width: '100%',
          padding: '12px 16px',
          borderRadius: '999px',
          border: 'none',
          background: '#6775b4',
          color: '#fff',
          fontWeight: 700,
          cursor: 'pointer',
        }}
      >
        {isPending ? 'Signing in...' : 'Sign In'}
      </button>
    </form>
  );
}