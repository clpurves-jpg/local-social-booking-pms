import Link from 'next/link';
import { getSupabaseAdmin } from '@/lib/supabase';

type Booking = {
  id: string;
  confirmation_code: string | null;
  guest_first_name: string | null;
  guest_last_name: string | null;
  check_in_date: string | null;
  check_out_date: string | null;
  gross_amount: number | null;
};

type Payment = {
  booking_id: string | null;
  amount_authorized: number | null;
  amount_captured: number | null;
  fee_amount: number | null;
  net_amount: number | null;
  status: string | null;
  provider: string | null;
};

function currency(n: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(n);
}

function guestName(b: Booking) {
  return [b.guest_first_name, b.guest_last_name].filter(Boolean).join(' ') || 'Guest';
}

function formatDate(d?: string | null) {
  if (!d) return '—';
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(d));
}

export default async function ReconciliationPage() {
  const supabase = getSupabaseAdmin();

  const [{ data: bookings }, { data: payments }] = await Promise.all([
    supabase
      .from('bookings')
      .select(
        `
        id,
        confirmation_code,
        guest_first_name,
        guest_last_name,
        check_in_date,
        check_out_date,
        gross_amount
      `
      )
      .not('status', 'in', '("cancelled","no_show")'),

    supabase.from('payments').select(
      `
      booking_id,
      amount_authorized,
      amount_captured,
      fee_amount,
      net_amount,
      status,
      provider
    `
    ),
  ]);

  const allBookings = bookings ?? [];
  const allPayments = payments ?? [];

  const rows = allBookings.map((booking: Booking) => {
    const payment = allPayments.find(
      (p: Payment) => p.booking_id === booking.id
    );

    const gross = Number(booking.gross_amount ?? 0);
    const captured = Number(payment?.amount_captured ?? 0);
    const fee = Number(payment?.fee_amount ?? 0);
    const net = Number(payment?.net_amount ?? 0);

    const variance = captured - gross;

    return {
      booking,
      payment,
      gross,
      captured,
      fee,
      net,
      variance,
    };
  });

  const totalGross = rows.reduce((sum, r) => sum + r.gross, 0);
  const totalCaptured = rows.reduce((sum, r) => sum + r.captured, 0);
  const totalFees = rows.reduce((sum, r) => sum + r.fee, 0);
  const totalNet = rows.reduce((sum, r) => sum + r.net, 0);

  return (
    <div style={{ padding: 40, display: 'grid', gap: 24 }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 16,
        }}
      >
        <div>
          <h1 style={{ margin: 0, color: '#0F3B5F' }}>
            Stripe Reconciliation
          </h1>
          <p style={{ marginTop: 8, color: '#64748b' }}>
            Compare booking totals with actual Stripe payments.
          </p>
        </div>

        <Link
          href="/reports"
          style={{
            padding: '10px 16px',
            borderRadius: 999,
            border: '1px solid #0F3B5F',
            textDecoration: 'none',
            color: '#0F3B5F',
            background: '#fff',
            fontWeight: 700,
          }}
        >
          Back to Reports
        </Link>
      </div>

      <div
        style={{
          display: 'grid',
          gap: 16,
          gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))',
        }}
      >
        <div style={{ background: '#fff', padding: 24, borderRadius: 24 }}>
          <div>Total Booking Gross</div>
          <div style={{ fontSize: 32, fontWeight: 700 }}>
            {currency(totalGross)}
          </div>
        </div>

        <div style={{ background: '#fff', padding: 24, borderRadius: 24 }}>
          <div>Total Stripe Captured</div>
          <div style={{ fontSize: 32, fontWeight: 700 }}>
            {currency(totalCaptured)}
          </div>
        </div>

        <div style={{ background: '#fff', padding: 24, borderRadius: 24 }}>
          <div>Total Stripe Fees</div>
          <div style={{ fontSize: 32, fontWeight: 700 }}>
            {currency(totalFees)}
          </div>
        </div>

        <div style={{ background: '#fff', padding: 24, borderRadius: 24 }}>
          <div>Total Net Deposits</div>
          <div style={{ fontSize: 32, fontWeight: 700 }}>
            {currency(totalNet)}
          </div>
        </div>
      </div>

      <div
        style={{
          background: '#fff',
          padding: 24,
          borderRadius: 24,
          overflowX: 'auto',
        }}
      >
        <table
          style={{
            width: '100%',
            borderCollapse: 'collapse',
            minWidth: 1200,
          }}
        >
          <thead>
            <tr style={{ borderBottom: '2px solid #e2e8f0' }}>
              <th align="left">Confirmation</th>
              <th align="left">Guest</th>
              <th align="left">Stay</th>
              <th align="right">Booking Gross</th>
              <th align="right">Captured</th>
              <th align="right">Stripe Fee</th>
              <th align="right">Net Deposit</th>
              <th align="right">Variance</th>
              <th align="left">Status</th>
            </tr>
          </thead>

          <tbody>
            {rows.map((r) => (
              <tr key={r.booking.id} style={{ borderBottom: '1px solid #eee' }}>
                <td>{r.booking.confirmation_code}</td>

                <td>{guestName(r.booking)}</td>

                <td>
                  {formatDate(r.booking.check_in_date)} →{' '}
                  {formatDate(r.booking.check_out_date)}
                </td>

                <td align="right">{currency(r.gross)}</td>

                <td align="right">{currency(r.captured)}</td>

                <td align="right">{currency(r.fee)}</td>

                <td align="right">{currency(r.net)}</td>

                <td align="right">{currency(r.variance)}</td>

                <td>{r.payment?.status ?? 'No Payment'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}