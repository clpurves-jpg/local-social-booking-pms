import Link from 'next/link';
import { getSupabaseAdmin } from '../../lib/supabase';

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
  return Array.isArray(payment.bookings)
    ? payment.bookings[0] ?? null
    : payment.bookings;
}

export default async function ReportsPage() {
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from('payments')
    .select(`
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
    `)
    .eq('status', 'paid')
    .order('paid_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to load reports: ${error.message}`);
  }

  const rows = (data ?? []) as PaymentRow[];

  let totalGross = 0;
  let totalRoomRevenue = 0;
  let totalPetFees = 0;
  let totalExtraCharges = 0;
  let totalNetRevenue = 0;

  const processed = rows.map((payment) => {
    const booking = getBooking(payment);
    const gross = Number(payment.amount_captured ?? 0);

    const petFee = Number(booking?.pet_fee ?? 0);
    const isManualCharge = !payment.booking_id;

    const extraCharge = isManualCharge ? gross : 0;
    const roomRevenue = isManualCharge ? 0 : Math.max(gross - petFee, 0);

    const netRevenue = roomRevenue;

    totalGross += gross;
    totalRoomRevenue += roomRevenue;
    totalPetFees += petFee;
    totalExtraCharges += extraCharge;
    totalNetRevenue += netRevenue;

    return {
      payment,
      booking,
      gross,
      petFee,
      extraCharge,
      roomRevenue,
      netRevenue,
    };
  });

  return (
    <div style={{ padding: 40, display: 'grid', gap: 24 }}>
      <h1 style={{ margin: 0, color: '#0F3B5F' }}>Revenue Report</h1>

      <div style={{ display: 'flex', gap: 12 }}>
        <Link href="/admin/reports/taxes">Tax Report</Link>
      </div>

      {/* SUMMARY */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
        <div>
          <div>Gross</div>
          <strong>{currency(totalGross)}</strong>
        </div>

        <div>
          <div>Room Revenue</div>
          <strong>{currency(totalRoomRevenue)}</strong>
        </div>

        <div>
          <div>Pet Fees</div>
          <strong>{currency(totalPetFees)}</strong>
        </div>

        <div>
          <div>Extra Charges</div>
          <strong>{currency(totalExtraCharges)}</strong>
        </div>
      </div>

      {/* TABLE */}
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th align="left">Confirmation</th>
            <th align="left">Guest</th>
            <th align="right">Gross</th>
            <th align="right">Pet Fee</th>
            <th align="right">Extra</th>
            <th align="right">Room Revenue</th>
          </tr>
        </thead>

        <tbody>
          {processed.map((r) => (
            <tr key={r.payment.id}>
              <td>{r.booking?.confirmation_code ?? '—'}</td>
              <td>
                {[r.booking?.guest_first_name, r.booking?.guest_last_name]
                  .filter(Boolean)
                  .join(' ') || r.booking?.guest_email || 'Guest'}
              </td>
              <td align="right">{currency(r.gross)}</td>
              <td align="right">{currency(r.petFee)}</td>
              <td align="right">{currency(r.extraCharge)}</td>
              <td align="right">{currency(r.roomRevenue)}</td>
            </tr>
          ))}

          <tr style={{ fontWeight: 700 }}>
            <td colSpan={2}>TOTAL</td>
            <td align="right">{currency(totalGross)}</td>
            <td align="right">{currency(totalPetFees)}</td>
            <td align="right">{currency(totalExtraCharges)}</td>
            <td align="right">{currency(totalRoomRevenue)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}