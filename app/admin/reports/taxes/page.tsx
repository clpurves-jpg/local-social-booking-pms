import Link from 'next/link';
import { getSupabaseAdmin } from '../../../../lib/supabase';

type SearchParams = {
  month?: string;
};

type PaymentBooking = {
  confirmation_code: string | null;
  guest_first_name: string | null;
  guest_last_name: string | null;
  guest_email: string | null;
  check_in_date: string | null;
  check_out_date: string | null;
  pet_fee?: number | null;
};

type PaymentRow = {
  id: string;
  booking_id: string | null;
  amount_captured: number | null;
  status: string | null;
  paid_at: string | null;
  bookings: PaymentBooking | PaymentBooking[] | null;
};

function currency(n: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(n);
}

function getBooking(payment: PaymentRow): PaymentBooking | null {
  if (!payment.bookings) return null;
  return Array.isArray(payment.bookings) ? payment.bookings[0] ?? null : payment.bookings;
}

function guestName(payment: PaymentRow) {
  const booking = getBooking(payment);
  if (!booking) return 'Guest';

  const name = [booking.guest_first_name, booking.guest_last_name]
    .filter(Boolean)
    .join(' ');

  return name || booking.guest_email || 'Guest';
}

function formatDate(d?: string | null) {
  if (!d) return '—';
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(d));
}

function monthLabel(month: string) {
  const [year, monthNum] = month.split('-').map(Number);
  const date = new Date(year, (monthNum || 1) - 1, 1);
  return new Intl.DateTimeFormat('en-US', {
    month: 'long',
    year: 'numeric',
  }).format(date);
}

function getCurrentMonth() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

function getMonthRange(month: string) {
  const [year, monthNum] = month.split('-').map(Number);
  const start = new Date(year, monthNum - 1, 1);
  const end = new Date(year, monthNum, 1);

  return {
    start: start.toISOString(),
    end: end.toISOString(),
  };
}

export default async function TaxReportPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>;
}) {
  const params = (await searchParams) ?? {};
  const selectedMonth = params.month || getCurrentMonth();
  const { start, end } = getMonthRange(selectedMonth);

  const supabase = getSupabaseAdmin();

  const { data: payments, error } = await supabase
    .from('payments')
    .select(
      `
        id,
        booking_id,
        amount_captured,
        status,
        paid_at,
        bookings (
          confirmation_code,
          guest_first_name,
          guest_last_name,
          guest_email,
          check_in_date,
          check_out_date,
          pet_fee
        )
      `
    )
    .in('status', ['paid', 'refunded'])
    .gte('paid_at', start)
    .lt('paid_at', end)
    .order('paid_at', { ascending: true });

  if (error) {
    throw new Error(`Failed to load tax report data: ${error.message}`);
  }

  const rows = (payments ?? []) as PaymentRow[];

  let totalGross = 0;
  let totalRoomRevenue = 0;
  let totalLocalTax = 0;
  let totalStateTax = 0;
  let totalTax = 0;
  let totalCardFees = 0;
  let totalNetDeposit = 0;
  let totalNetRevenue = 0;
  let totalPetFees = 0;
  let totalExtraCharges = 0;
  let totalRefunds = 0;

  const processed = rows.map((payment) => {
    const booking = getBooking(payment);

    const rawAmount = Number(payment.amount_captured ?? 0);
    const isRefund = payment.status === 'refunded';

    const gross = isRefund ? 0 : rawAmount;
    const refundAmount = isRefund ? rawAmount : 0;

    const petFee = isRefund ? 0 : Number(booking?.pet_fee ?? 0);
    const isManualCharge = !payment.booking_id && !isRefund;

    const taxableGross = isManualCharge ? 0 : Math.max(gross - petFee, 0);
    const extraCharge = isManualCharge ? gross : 0;

    const roomRevenue = taxableGross / 1.085;
    const localTax = roomRevenue * 0.07;
    const stateTax = roomRevenue * 0.015;
    const taxTotal = localTax + stateTax;

    const cardFee = isRefund ? 0 : gross * 0.029 + 0.3;
    const netDeposit = gross - cardFee - refundAmount;
    const netRevenue = roomRevenue + petFee + extraCharge - cardFee - refundAmount;

    totalGross += gross;
    totalRoomRevenue += roomRevenue;
    totalLocalTax += localTax;
    totalStateTax += stateTax;
    totalTax += taxTotal;
    totalCardFees += cardFee;
    totalNetDeposit += netDeposit;
    totalNetRevenue += netRevenue;
    totalPetFees += petFee;
    totalExtraCharges += extraCharge;
    totalRefunds += refundAmount;

    return {
      payment,
      booking,
      gross,
      refundAmount,
      petFee,
      extraCharge,
      roomRevenue,
      localTax,
      stateTax,
      taxTotal,
      cardFee,
      netDeposit,
      netRevenue,
    };
  });

  return (
    <div style={{ padding: 40, display: 'grid', gap: 24 }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: 16,
          flexWrap: 'wrap',
        }}
      >
        <div>
          <h1 style={{ margin: 0, color: '#0F3B5F' }}>Tax Filing Report</h1>
          <p style={{ margin: '10px 0 0 0', color: '#64748b' }}>
            Tax report for payments collected in {monthLabel(selectedMonth)}.
          </p>
        </div>

        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <Link
            href="/admin/reports"
            style={{
              padding: '10px 16px',
              borderRadius: 999,
              border: '1px solid #cbd5e1',
              textDecoration: 'none',
              color: '#334155',
              background: '#fff',
              fontWeight: 700,
            }}
          >
            Back to Reports
          </Link>

          <Link
            href={`/admin/reports/taxes?month=${getCurrentMonth()}`}
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
            Current Month
          </Link>

          <a
            href={`/admin/reports/taxes/export?month=${selectedMonth}`}
            style={{
              padding: '10px 16px',
              borderRadius: 999,
              border: '1px solid #166534',
              textDecoration: 'none',
              color: '#166534',
              background: '#fff',
              fontWeight: 700,
            }}
          >
            Export CSV
          </a>
        </div>
      </div>

      <form
        method="get"
        style={{
          background: '#fff',
          borderRadius: 24,
          padding: 24,
          boxShadow: '0 8px 24px rgba(15, 23, 42, 0.08)',
          display: 'flex',
          gap: 12,
          alignItems: 'end',
          flexWrap: 'wrap',
        }}
      >
        <div>
          <label
            htmlFor="month"
            style={{
              display: 'block',
              marginBottom: 8,
              fontSize: 13,
              fontWeight: 700,
              color: '#334155',
            }}
          >
            Filing Month
          </label>
          <input
            id="month"
            name="month"
            type="month"
            defaultValue={selectedMonth}
            style={{
              padding: '12px 14px',
              borderRadius: 14,
              border: '1px solid #cbd5e1',
              fontSize: 14,
              color: '#0f172a',
              background: '#fff',
            }}
          />
        </div>

        <button
          type="submit"
          style={{
            padding: '12px 18px',
            borderRadius: 999,
            border: '1px solid #0F3B5F',
            background: '#0F3B5F',
            color: '#fff',
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          Run Report
        </button>
      </form>

      <div
        style={{
          display: 'grid',
          gap: 16,
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        }}
      >
        <div
          style={{
            background: '#fff',
            borderRadius: 24,
            padding: 24,
            boxShadow: '0 8px 24px rgba(15, 23, 42, 0.08)',
          }}
        >
          <div style={{ fontSize: 14, color: '#64748b', fontWeight: 600 }}>
            Gross Collected
          </div>
          <div style={{ marginTop: 10, fontSize: 36, fontWeight: 700, color: '#0f172a' }}>
            {currency(totalGross)}
          </div>
        </div>

        <div
          style={{
            background: '#fff',
            borderRadius: 24,
            padding: 24,
            boxShadow: '0 8px 24px rgba(15, 23, 42, 0.08)',
          }}
        >
          <div style={{ fontSize: 14, color: '#64748b', fontWeight: 600 }}>
            Refunds
          </div>
          <div style={{ marginTop: 10, fontSize: 36, fontWeight: 700, color: '#0f172a' }}>
            {currency(totalRefunds)}
          </div>
        </div>

        <div
          style={{
            background: '#fff',
            borderRadius: 24,
            padding: 24,
            boxShadow: '0 8px 24px rgba(15, 23, 42, 0.08)',
          }}
        >
          <div style={{ fontSize: 14, color: '#64748b', fontWeight: 600 }}>
            Pet Fees
          </div>
          <div style={{ marginTop: 10, fontSize: 36, fontWeight: 700, color: '#0f172a' }}>
            {currency(totalPetFees)}
          </div>
        </div>

        <div
          style={{
            background: '#fff',
            borderRadius: 24,
            padding: 24,
            boxShadow: '0 8px 24px rgba(15, 23, 42, 0.08)',
          }}
        >
          <div style={{ fontSize: 14, color: '#64748b', fontWeight: 600 }}>
            Extra Charges
          </div>
          <div style={{ marginTop: 10, fontSize: 36, fontWeight: 700, color: '#0f172a' }}>
            {currency(totalExtraCharges)}
          </div>
        </div>

        <div
          style={{
            background: '#fff',
            borderRadius: 24,
            padding: 24,
            boxShadow: '0 8px 24px rgba(15, 23, 42, 0.08)',
          }}
        >
          <div style={{ fontSize: 14, color: '#64748b', fontWeight: 600 }}>
            Local Tax Due
          </div>
          <div style={{ marginTop: 10, fontSize: 36, fontWeight: 700, color: '#0f172a' }}>
            {currency(totalLocalTax)}
          </div>
        </div>

        <div
          style={{
            background: '#fff',
            borderRadius: 24,
            padding: 24,
            boxShadow: '0 8px 24px rgba(15, 23, 42, 0.08)',
          }}
        >
          <div style={{ fontSize: 14, color: '#64748b', fontWeight: 600 }}>
            State Tax Due
          </div>
          <div style={{ marginTop: 10, fontSize: 36, fontWeight: 700, color: '#0f172a' }}>
            {currency(totalStateTax)}
          </div>
        </div>

        <div
          style={{
            background: '#fff',
            borderRadius: 24,
            padding: 24,
            boxShadow: '0 8px 24px rgba(15, 23, 42, 0.08)',
          }}
        >
          <div style={{ fontSize: 14, color: '#64748b', fontWeight: 600 }}>
            Total Tax Due
          </div>
          <div style={{ marginTop: 10, fontSize: 36, fontWeight: 700, color: '#0f172a' }}>
            {currency(totalTax)}
          </div>
        </div>
      </div>

      <div
        style={{
          background: '#fff',
          borderRadius: 24,
          padding: 24,
          boxShadow: '0 8px 24px rgba(15, 23, 42, 0.08)',
          overflowX: 'auto',
        }}
      >
        <h2 style={{ marginTop: 0, color: '#0F3B5F' }}>Monthly Tax Detail</h2>

        <table
          style={{
            width: '100%',
            borderCollapse: 'collapse',
            fontSize: 14,
            minWidth: 1500,
          }}
        >
          <thead>
            <tr style={{ borderBottom: '2px solid #e2e8f0' }}>
              <th align="left" style={{ padding: '12px 8px' }}>Confirmation</th>
              <th align="left" style={{ padding: '12px 8px' }}>Guest</th>
              <th align="left" style={{ padding: '12px 8px' }}>Check-In</th>
              <th align="left" style={{ padding: '12px 8px' }}>Check-Out</th>
              <th align="right" style={{ padding: '12px 8px' }}>Gross</th>
              <th align="right" style={{ padding: '12px 8px' }}>Refund</th>
              <th align="right" style={{ padding: '12px 8px' }}>Pet Fees</th>
              <th align="right" style={{ padding: '12px 8px' }}>Extra Charges</th>
              <th align="right" style={{ padding: '12px 8px' }}>Room Revenue</th>
              <th align="right" style={{ padding: '12px 8px' }}>Local Tax</th>
              <th align="right" style={{ padding: '12px 8px' }}>State Tax</th>
              <th align="right" style={{ padding: '12px 8px' }}>Total Tax</th>
              <th align="right" style={{ padding: '12px 8px' }}>Card Fee</th>
              <th align="right" style={{ padding: '12px 8px' }}>Net Deposit</th>
              <th align="right" style={{ padding: '12px 8px' }}>Net Revenue</th>
            </tr>
          </thead>

          <tbody>
            {processed.map((r) => (
              <tr
                key={r.payment.id}
                style={{
                  borderBottom: '1px solid #e2e8f0',
                  background: r.refundAmount > 0 ? '#fef2f2' : '#ffffff',
                }}
              >
                <td style={{ padding: '12px 8px' }}>{r.booking?.confirmation_code ?? '—'}</td>
                <td style={{ padding: '12px 8px' }}>{guestName(r.payment)}</td>
                <td style={{ padding: '12px 8px' }}>{formatDate(r.booking?.check_in_date)}</td>
                <td style={{ padding: '12px 8px' }}>{formatDate(r.booking?.check_out_date)}</td>
                <td align="right" style={{ padding: '12px 8px' }}>{currency(r.gross)}</td>
                <td align="right" style={{ padding: '12px 8px' }}>{currency(r.refundAmount)}</td>
                <td align="right" style={{ padding: '12px 8px' }}>{currency(r.petFee)}</td>
                <td align="right" style={{ padding: '12px 8px' }}>{currency(r.extraCharge)}</td>
                <td align="right" style={{ padding: '12px 8px' }}>{currency(r.roomRevenue)}</td>
                <td align="right" style={{ padding: '12px 8px' }}>{currency(r.localTax)}</td>
                <td align="right" style={{ padding: '12px 8px' }}>{currency(r.stateTax)}</td>
                <td align="right" style={{ padding: '12px 8px' }}>{currency(r.taxTotal)}</td>
                <td align="right" style={{ padding: '12px 8px' }}>{currency(r.cardFee)}</td>
                <td align="right" style={{ padding: '12px 8px' }}>{currency(r.netDeposit)}</td>
                <td align="right" style={{ padding: '12px 8px' }}>{currency(r.netRevenue)}</td>
              </tr>
            ))}

            <tr style={{ fontWeight: 700, background: '#f8fafc' }}>
              <td colSpan={4} style={{ padding: '14px 8px' }}>TOTALS</td>
              <td align="right" style={{ padding: '14px 8px' }}>{currency(totalGross)}</td>
              <td align="right" style={{ padding: '14px 8px' }}>{currency(totalRefunds)}</td>
              <td align="right" style={{ padding: '14px 8px' }}>{currency(totalPetFees)}</td>
              <td align="right" style={{ padding: '14px 8px' }}>{currency(totalExtraCharges)}</td>
              <td align="right" style={{ padding: '14px 8px' }}>{currency(totalRoomRevenue)}</td>
              <td align="right" style={{ padding: '14px 8px' }}>{currency(totalLocalTax)}</td>
              <td align="right" style={{ padding: '14px 8px' }}>{currency(totalStateTax)}</td>
              <td align="right" style={{ padding: '14px 8px' }}>{currency(totalTax)}</td>
              <td align="right" style={{ padding: '14px 8px' }}>{currency(totalCardFees)}</td>
              <td align="right" style={{ padding: '14px 8px' }}>{currency(totalNetDeposit)}</td>
              <td align="right" style={{ padding: '14px 8px' }}>{currency(totalNetRevenue)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}