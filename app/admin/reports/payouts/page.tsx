import Link from 'next/link';
import { redirect } from 'next/navigation';
import Stripe from 'stripe';
import { requireRole } from '../../../../lib/auth';
import { getSupabaseAdmin } from '../../../../lib/supabase';

function formatMoney(value?: number | null) {
  const amount = typeof value === 'number' ? value : 0;

  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount);
}

function formatDate(value?: string | number | null) {
  if (value === null || value === undefined) return '—';

  const date =
    typeof value === 'number'
      ? new Date(value * 1000)
      : new Date(value);

  if (Number.isNaN(date.getTime())) return '—';

  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
}

function cardStyle(): React.CSSProperties {
  return {
    background: '#ffffff',
    borderRadius: '24px',
    padding: '24px',
    boxShadow: '0 8px 24px rgba(15, 23, 42, 0.08)',
  };
}

type PaymentBooking = {
  id?: string | null;
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
  amount_authorized?: number | null;
  status: string | null;
  paid_at: string | null;
  created_at?: string | null;
  provider_checkout_session_id?: string | null;
  provider_payment_intent_id?: string | null;
  bookings: PaymentBooking | PaymentBooking[] | null;
};

type PayoutMatch = {
  payoutId: string;
  payoutStatus: string;
  payoutArrivalDate: number | null;
};

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

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;

if (!stripeSecretKey) {
  throw new Error('Missing STRIPE_SECRET_KEY environment variable.');
}

const stripe = new Stripe(stripeSecretKey, {
  apiVersion: '2025-02-24.acacia',
});

async function buildChargeToPayoutMap(): Promise<Map<string, PayoutMatch>> {
  const map = new Map<string, PayoutMatch>();

  const payouts = await stripe.payouts.list({ limit: 100 });

  for (const payout of payouts.data) {
    let startingAfter: string | undefined;

    while (true) {
      const txns = await stripe.balanceTransactions.list({
        payout: payout.id,
        limit: 100,
        starting_after: startingAfter,
      });

      for (const txn of txns.data) {
        if (typeof txn.source === 'string' && txn.source.startsWith('ch_')) {
          map.set(txn.source, {
            payoutId: payout.id,
            payoutStatus: payout.status,
            payoutArrivalDate: payout.arrival_date ?? null,
          });
        }
      }

      if (!txns.has_more || txns.data.length === 0) break;
      startingAfter = txns.data[txns.data.length - 1].id;
    }
  }

  return map;
}

export default async function AdminReportsPage() {
  const profile = await requireRole(['admin']);

  if (!profile) {
    redirect('/admin/login');
  }

  const supabase = getSupabaseAdmin();

  const { data: payments, error } = await supabase
    .from('payments')
    .select(
      `
        id,
        booking_id,
        amount_captured,
        amount_authorized,
        status,
        paid_at,
        created_at,
        provider_checkout_session_id,
        provider_payment_intent_id,
        bookings (
          id,
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
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to load reports: ${error.message}`);
  }

  const rows = (payments ?? []) as PaymentRow[];
  const totalPayments = rows.length;

  const chargeToPayoutMap = await buildChargeToPayoutMap();

  const uniquePaymentIntentIds = [
    ...new Set(
      rows
        .map((row) => row.provider_payment_intent_id)
        .filter((id): id is string => Boolean(id))
    ),
  ];

  const paymentIntentToChargeMap = new Map<string, string>();

  await Promise.all(
    uniquePaymentIntentIds.map(async (paymentIntentId) => {
      try {
        const pi = await stripe.paymentIntents.retrieve(paymentIntentId, {
          expand: ['latest_charge'],
        });

        const latestCharge = pi.latest_charge;
        const chargeId =
          typeof latestCharge === 'string'
            ? latestCharge
            : latestCharge?.id ?? null;

        if (chargeId) {
          paymentIntentToChargeMap.set(paymentIntentId, chargeId);
        }
      } catch {
        // Ignore lookup failures so the page still renders.
      }
    })
  );

  let totalGross = 0;
  let totalRoomRevenue = 0;
  let totalPetFees = 0;
  let totalExtraCharges = 0;
  let totalLocalTax = 0;
  let totalStateTax = 0;
  let totalTax = 0;
  let totalCardFees = 0;
  let totalRefunds = 0;
  let totalNetDeposit = 0;
  let totalNetRevenue = 0;
  let totalNetAfterRefunds = 0;

  let totalPaidOutRows = 0;
  let totalPendingPayoutRows = 0;
  let totalRefundedRows = 0;

  const processed = rows.map((payment) => {
    const booking = getBooking(payment);
    const rawAmount = Number(payment.amount_captured ?? payment.amount_authorized ?? 0);

    const isRefund = payment.status === 'refunded';
    const gross = isRefund ? 0 : rawAmount;
    const refundAmount = isRefund ? rawAmount : 0;

    const petFee = isRefund ? 0 : Number(booking?.pet_fee ?? 0);

    const isManualCharge = !isRefund && !payment.provider_checkout_session_id;

    const taxableGross = isManualCharge ? 0 : Math.max(gross - petFee, 0);
    const extraCharge = isManualCharge ? gross : 0;

    const roomRevenue = taxableGross / 1.085;
    const localTax = roomRevenue * 0.07;
    const stateTax = roomRevenue * 0.015;
    const taxTotal = localTax + stateTax;

    const cardFee = isRefund ? 0 : gross * 0.029 + 0.3;
    const netDeposit = gross - cardFee - refundAmount;
    const netRevenue = roomRevenue + petFee + extraCharge - cardFee - refundAmount;
    const netAfterRefunds = gross - refundAmount;

    const chargeId = payment.provider_payment_intent_id
      ? paymentIntentToChargeMap.get(payment.provider_payment_intent_id) ?? null
      : null;

    const payoutMatch = chargeId ? chargeToPayoutMap.get(chargeId) ?? null : null;

    let payoutStatus = '—';

    if (refundAmount > 0) {
      payoutStatus = 'Refunded';
      totalRefundedRows += 1;
    } else if (payoutMatch?.payoutStatus === 'paid') {
      payoutStatus = 'Paid Out';
      totalPaidOutRows += 1;
    } else if (
      payoutMatch?.payoutStatus === 'pending' ||
      payoutMatch?.payoutStatus === 'in_transit'
    ) {
      payoutStatus = 'In Transit';
      totalPendingPayoutRows += 1;
    } else if (gross > 0) {
      payoutStatus = 'Pending Payout';
      totalPendingPayoutRows += 1;
    }

    totalGross += gross;
    totalRoomRevenue += roomRevenue;
    totalPetFees += petFee;
    totalExtraCharges += extraCharge;
    totalLocalTax += localTax;
    totalStateTax += stateTax;
    totalTax += taxTotal;
    totalCardFees += cardFee;
    totalRefunds += refundAmount;
    totalNetDeposit += netDeposit;
    totalNetRevenue += netRevenue;
    totalNetAfterRefunds += netAfterRefunds;

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
      netAfterRefunds,
      chargeId,
      payoutId: payoutMatch?.payoutId ?? null,
      payoutArrivalDate: payoutMatch?.payoutArrivalDate ?? null,
      payoutStatus,
    };
  });

  const recentPayments = processed.slice(0, 10);

  return (
    <div style={{ display: 'grid', gap: '24px' }}>
      <section style={cardStyle()}>
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: '12px',
            marginBottom: '18px',
          }}
        >
          <div>
            <h2
              style={{
                margin: 0,
                fontSize: '28px',
                color: '#0F3B5F',
              }}
            >
              Reports
            </h2>

            <p
              style={{
                margin: '8px 0 0 0',
                color: '#64748b',
                fontSize: '15px',
              }}
            >
              Revenue, refunds, pet fees, extra charges, taxes, fees, net revenue, and payout status overview.
            </p>

            <p
              style={{
                margin: '8px 0 0 0',
                color: '#94a3b8',
                fontSize: '13px',
              }}
            >
              Signed in as {profile.email} · {profile.role}
            </p>
          </div>

          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            <Link
              href="/admin/reports/taxes"
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
              View Tax Report
            </Link>

            <Link
              href="/admin/reports/payouts"
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
              View Payouts
            </Link>
          </div>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: '16px',
            marginBottom: '24px',
          }}
        >
          <div style={{ padding: '18px', borderRadius: '16px', background: '#f1f5f9' }}>
            <div style={{ fontSize: '14px', color: '#64748b' }}>Total Payment Rows</div>
            <div style={{ fontSize: '28px', fontWeight: 700, color: '#0f172a', marginTop: '6px' }}>
              {totalPayments}
            </div>
          </div>

          <div style={{ padding: '18px', borderRadius: '16px', background: '#f1f5f9' }}>
            <div style={{ fontSize: '14px', color: '#64748b' }}>Gross Collected</div>
            <div style={{ fontSize: '28px', fontWeight: 700, color: '#0f172a', marginTop: '6px' }}>
              {formatMoney(totalGross)}
            </div>
          </div>

          <div style={{ padding: '18px', borderRadius: '16px', background: '#f1f5f9' }}>
            <div style={{ fontSize: '14px', color: '#64748b' }}>Refunds</div>
            <div style={{ fontSize: '28px', fontWeight: 700, color: '#0f172a', marginTop: '6px' }}>
              {formatMoney(totalRefunds)}
            </div>
          </div>

          <div style={{ padding: '18px', borderRadius: '16px', background: '#f1f5f9' }}>
            <div style={{ fontSize: '14px', color: '#64748b' }}>Net After Refunds</div>
            <div style={{ fontSize: '28px', fontWeight: 700, color: '#0f172a', marginTop: '6px' }}>
              {formatMoney(totalNetAfterRefunds)}
            </div>
          </div>

          <div style={{ padding: '18px', borderRadius: '16px', background: '#ecfdf5' }}>
            <div style={{ fontSize: '14px', color: '#166534' }}>Paid Out Rows</div>
            <div style={{ fontSize: '28px', fontWeight: 700, color: '#166534', marginTop: '6px' }}>
              {totalPaidOutRows}
            </div>
          </div>

          <div style={{ padding: '18px', borderRadius: '16px', background: '#eff6ff' }}>
            <div style={{ fontSize: '14px', color: '#1d4ed8' }}>Pending Payout Rows</div>
            <div style={{ fontSize: '28px', fontWeight: 700, color: '#1d4ed8', marginTop: '6px' }}>
              {totalPendingPayoutRows}
            </div>
          </div>

          <div style={{ padding: '18px', borderRadius: '16px', background: '#fef2f2' }}>
            <div style={{ fontSize: '14px', color: '#991b1b' }}>Refunded Rows</div>
            <div style={{ fontSize: '28px', fontWeight: 700, color: '#991b1b', marginTop: '6px' }}>
              {totalRefundedRows}
            </div>
          </div>

          <div style={{ padding: '18px', borderRadius: '16px', background: '#f1f5f9' }}>
            <div style={{ fontSize: '14px', color: '#64748b' }}>Room Revenue</div>
            <div style={{ fontSize: '28px', fontWeight: 700, color: '#0f172a', marginTop: '6px' }}>
              {formatMoney(totalRoomRevenue)}
            </div>
          </div>

          <div style={{ padding: '18px', borderRadius: '16px', background: '#f1f5f9' }}>
            <div style={{ fontSize: '14px', color: '#64748b' }}>Pet Fees</div>
            <div style={{ fontSize: '28px', fontWeight: 700, color: '#0f172a', marginTop: '6px' }}>
              {formatMoney(totalPetFees)}
            </div>
          </div>

          <div style={{ padding: '18px', borderRadius: '16px', background: '#f1f5f9' }}>
            <div style={{ fontSize: '14px', color: '#64748b' }}>Extra Charges</div>
            <div style={{ fontSize: '28px', fontWeight: 700, color: '#0f172a', marginTop: '6px' }}>
              {formatMoney(totalExtraCharges)}
            </div>
          </div>

          <div style={{ padding: '18px', borderRadius: '16px', background: '#f1f5f9' }}>
            <div style={{ fontSize: '14px', color: '#64748b' }}>Local Tax</div>
            <div style={{ fontSize: '28px', fontWeight: 700, color: '#0f172a', marginTop: '6px' }}>
              {formatMoney(totalLocalTax)}
            </div>
          </div>

          <div style={{ padding: '18px', borderRadius: '16px', background: '#f1f5f9' }}>
            <div style={{ fontSize: '14px', color: '#64748b' }}>State Tax</div>
            <div style={{ fontSize: '28px', fontWeight: 700, color: '#0f172a', marginTop: '6px' }}>
              {formatMoney(totalStateTax)}
            </div>
          </div>

          <div style={{ padding: '18px', borderRadius: '16px', background: '#f1f5f9' }}>
            <div style={{ fontSize: '14px', color: '#64748b' }}>Total Tax</div>
            <div style={{ fontSize: '28px', fontWeight: 700, color: '#0f172a', marginTop: '6px' }}>
              {formatMoney(totalTax)}
            </div>
          </div>

          <div style={{ padding: '18px', borderRadius: '16px', background: '#f1f5f9' }}>
            <div style={{ fontSize: '14px', color: '#64748b' }}>Card Fees</div>
            <div style={{ fontSize: '28px', fontWeight: 700, color: '#0f172a', marginTop: '6px' }}>
              {formatMoney(totalCardFees)}
            </div>
          </div>

          <div style={{ padding: '18px', borderRadius: '16px', background: '#f1f5f9' }}>
            <div style={{ fontSize: '14px', color: '#64748b' }}>Net Deposit</div>
            <div style={{ fontSize: '28px', fontWeight: 700, color: '#0f172a', marginTop: '6px' }}>
              {formatMoney(totalNetDeposit)}
            </div>
          </div>

          <div style={{ padding: '18px', borderRadius: '16px', background: '#f1f5f9' }}>
            <div style={{ fontSize: '14px', color: '#64748b' }}>Net Revenue</div>
            <div style={{ fontSize: '28px', fontWeight: 700, color: '#0f172a', marginTop: '6px' }}>
              {formatMoney(totalNetRevenue)}
            </div>
          </div>
        </div>

        <div>
          <h3 style={{ marginBottom: '12px' }}>Recent Payment Activity</h3>

          {recentPayments.length === 0 ? (
            <p style={{ color: '#64748b' }}>No payments found.</p>
          ) : (
            <div style={{ display: 'grid', gap: '12px' }}>
              {recentPayments.map((row) => {
                const booking = row.booking;
                const guestDisplay = guestName(row.payment);

                return (
                  <div
                    key={row.payment.id}
                    style={{
                      border: '1px solid #e2e8f0',
                      borderRadius: '12px',
                      padding: '14px',
                      background: row.refundAmount > 0 ? '#fef2f2' : '#f8fafc',
                    }}
                  >
                    <div style={{ fontWeight: 600, color: '#0f172a' }}>
                      {guestDisplay}
                    </div>

                    <div
                      style={{
                        marginTop: '4px',
                        fontSize: '13px',
                        color: '#64748b',
                      }}
                    >
                      {formatDate(row.payment.created_at ?? row.payment.paid_at)}
                    </div>

                    <div
                      style={{
                        marginTop: '8px',
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
                        gap: '8px',
                        fontSize: '14px',
                        color: '#334155',
                      }}
                    >
                      <div>
                        <strong>Confirmation:</strong> {booking?.confirmation_code ?? '—'}
                      </div>
                      <div>
                        <strong>Status:</strong> {row.payment.status ?? '—'}
                      </div>
                      <div>
                        <strong>Payout Status:</strong> {row.payoutStatus}
                      </div>
                      <div>
                        <strong>Payout ID:</strong> {row.payoutId ?? '—'}
                      </div>
                      <div>
                        <strong>Payout Arrival:</strong> {formatDate(row.payoutArrivalDate)}
                      </div>
                      <div>
                        <strong>Gross:</strong> {formatMoney(row.gross)}
                      </div>
                      <div>
                        <strong>Refund:</strong> {formatMoney(row.refundAmount)}
                      </div>
                      <div>
                        <strong>Pet Fees:</strong> {formatMoney(row.petFee)}
                      </div>
                      <div>
                        <strong>Extra Charges:</strong> {formatMoney(row.extraCharge)}
                      </div>
                      <div>
                        <strong>Local Tax:</strong> {formatMoney(row.localTax)}
                      </div>
                      <div>
                        <strong>State Tax:</strong> {formatMoney(row.stateTax)}
                      </div>
                      <div>
                        <strong>Card Fee:</strong> {formatMoney(row.cardFee)}
                      </div>
                      <div>
                        <strong>Net Revenue:</strong> {formatMoney(row.netRevenue)}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}