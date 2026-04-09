import Link from 'next/link';
import { getSupabaseAdmin } from '@/lib/supabase';

type Booking = {
  gross_amount: number | null;
  check_in_date: string | null;
  status: string | null;
};

function currency(n: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(n);
}

function monthLabel(date: Date) {
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

export default async function MonthlyReportPage() {
  const supabase = getSupabaseAdmin();

  const selectedMonth = getCurrentMonth();

  const { data: bookings, error } = await supabase
    .from('bookings')
    .select('gross_amount,check_in_date,status')
    .not('status', 'in', '("cancelled","no_show")');

  if (error) {
    throw new Error(error.message);
  }

  const rows = (bookings ?? []) as Booking[];

  const months: Record<
    string,
    {
      date: Date;
      gross: number;
      roomRevenue: number;
      localTax: number;
      stateTax: number;
      taxTotal: number;
      cardFees: number;
      netDeposit: number;
      netRevenue: number;
    }
  > = {};

  rows.forEach((b) => {
    if (!b.check_in_date) return;

    const d = new Date(b.check_in_date);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

    if (!months[key]) {
      months[key] = {
        date: new Date(d.getFullYear(), d.getMonth(), 1),
        gross: 0,
        roomRevenue: 0,
        localTax: 0,
        stateTax: 0,
        taxTotal: 0,
        cardFees: 0,
        netDeposit: 0,
        netRevenue: 0,
      };
    }

    const gross = Number(b.gross_amount ?? 0);
    const roomRevenue = gross / 1.085;
    const localTax = roomRevenue * 0.07;
    const stateTax = roomRevenue * 0.015;
    const taxTotal = localTax + stateTax;
    const cardFee = gross * 0.029 + 0.3;
    const netDeposit = gross - cardFee;
    const netRevenue = roomRevenue - cardFee;

    months[key].gross += gross;
    months[key].roomRevenue += roomRevenue;
    months[key].localTax += localTax;
    months[key].stateTax += stateTax;
    months[key].taxTotal += taxTotal;
    months[key].cardFees += cardFee;
    months[key].netDeposit += netDeposit;
    months[key].netRevenue += netRevenue;
  });

  const sortedMonths = Object.entries(months)
    .sort(([, a], [, b]) => b.date.getTime() - a.date.getTime())
    .map(([key, value]) => ({ key, ...value }));

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
          <h1 style={{ margin: 0, color: '#0F3B5F' }}>Monthly Summary</h1>
          <p style={{ marginTop: 8, color: '#64748b' }}>
            Revenue, taxes, fees, and net income by month.
          </p>
        </div>

        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
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

          <a
            href={`/reports/monthly/export?month=${selectedMonth}`}
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

      <div
        style={{
          background: '#fff',
          borderRadius: 24,
          padding: 24,
          boxShadow: '0 8px 24px rgba(15, 23, 42, 0.08)',
          overflowX: 'auto',
        }}
      >
        <table
          style={{
            width: '100%',
            borderCollapse: 'collapse',
            minWidth: 1100,
          }}
        >
          <thead>
            <tr style={{ borderBottom: '2px solid #e2e8f0' }}>
              <th align="left" style={{ padding: '12px 8px' }}>
                Month
              </th>
              <th align="right" style={{ padding: '12px 8px' }}>
                Gross
              </th>
              <th align="right" style={{ padding: '12px 8px' }}>
                Room Revenue
              </th>
              <th align="right" style={{ padding: '12px 8px' }}>
                Local Tax
              </th>
              <th align="right" style={{ padding: '12px 8px' }}>
                State Tax
              </th>
              <th align="right" style={{ padding: '12px 8px' }}>
                Total Tax
              </th>
              <th align="right" style={{ padding: '12px 8px' }}>
                Card Fees
              </th>
              <th align="right" style={{ padding: '12px 8px' }}>
                Net Deposit
              </th>
              <th align="right" style={{ padding: '12px 8px' }}>
                Net Revenue
              </th>
            </tr>
          </thead>

          <tbody>
            {sortedMonths.map((m) => (
              <tr key={m.key} style={{ borderBottom: '1px solid #e2e8f0' }}>
                <td style={{ padding: '12px 8px' }}>{monthLabel(m.date)}</td>
                <td align="right" style={{ padding: '12px 8px' }}>
                  {currency(m.gross)}
                </td>
                <td align="right" style={{ padding: '12px 8px' }}>
                  {currency(m.roomRevenue)}
                </td>
                <td align="right" style={{ padding: '12px 8px' }}>
                  {currency(m.localTax)}
                </td>
                <td align="right" style={{ padding: '12px 8px' }}>
                  {currency(m.stateTax)}
                </td>
                <td align="right" style={{ padding: '12px 8px' }}>
                  {currency(m.taxTotal)}
                </td>
                <td align="right" style={{ padding: '12px 8px' }}>
                  {currency(m.cardFees)}
                </td>
                <td align="right" style={{ padding: '12px 8px' }}>
                  {currency(m.netDeposit)}
                </td>
                <td align="right" style={{ padding: '12px 8px' }}>
                  {currency(m.netRevenue)}
                </td>
              </tr>
            ))}

            {!sortedMonths.length ? (
              <tr>
                <td colSpan={9} style={{ padding: '16px 8px', color: '#64748b' }}>
                  No monthly data found.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}