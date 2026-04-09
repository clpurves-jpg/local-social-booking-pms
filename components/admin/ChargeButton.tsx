'use client';

import { useState } from 'react';

export default function ChargeButton({ bookingId }: { bookingId: string }) {
  const [loading, setLoading] = useState(false);

  async function handleCharge() {
    const amount = prompt('Enter amount to charge:');
    const reason = prompt('Reason for charge:');

    if (!amount) return;

    try {
      setLoading(true);

      const res = await fetch('/api/admin/charge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ booking_id: bookingId, amount: Number(amount), reason }),
      });

      const data = await res.json();

      if (!res.ok) {
        alert(data.error || 'Charge failed');
        return;
      }

      alert('Charge successful');
    } catch {
      alert('Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleCharge}
      disabled={loading}
      style={{
        padding: '6px 10px',
        borderRadius: '999px',
        border: 'none',
        background: '#475569',
        color: '#fff',
        fontWeight: 600,
        fontSize: '12px',
        cursor: 'pointer',
      }}
    >
      {loading ? 'Charging...' : 'Charge'}
    </button>
  );
}