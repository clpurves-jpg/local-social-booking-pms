import Link from 'next/link';
import { getSupabaseAdmin } from '../../../lib/supabase';

export const dynamic = 'force-dynamic';

type SearchParams = {
  [key: string]: string | string[] | undefined;
};

function normalizeParam(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? '' : value ?? '';
}

function formatDateLabel(date: string | null | undefined): string {
  if (!date) return '—';
  const parsed = new Date(`${date}T12:00:00`);
  return new Intl.DateTimeFormat('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(parsed);
}

function formatMoney(value: number | null | undefined): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(Number(value ?? 0));
}

const shellStyle: React.CSSProperties = {
  minHeight: '100vh',
  background: '#f8fafc',
};

const containerStyle: React.CSSProperties = {
  maxWidth: '920px',
  margin: '0 auto',
  padding: '32px 16px 56px',
};

const heroStyle: React.CSSProperties = {
  borderRadius: '28px',
  padding: '32px',
  background:
    'linear-gradient(135deg, #0f172a 0%, #1e293b 55%, #334155 100%)',
  color: '#ffffff',
  boxShadow: '0 12px 32px rgba(15, 23, 42, 0.12)',
  border: '1px solid rgba(255,255,255,0.08)',
};

const cardStyle: React.CSSProperties = {
  background: '#ffffff',
  border: '1px solid #e2e8f0',
  borderRadius: '22px',
  boxShadow: '0 8px 24px rgba(15, 23, 42, 0.06)',
};

const pillStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  borderRadius: '999px',
  padding: '6px 12px',
  fontSize: '12px',
  fontWeight: 700,
};

const actionLinkStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  borderRadius: '999px',
  padding: '12px 18px',
  fontSize: '14px',
  fontWeight: 600,
  textDecoration: 'none',
};

export default async function BookingConfirmationPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>;
}) {
  const params = searchParams ? await searchParams : {};
  const bookingId = normalizeParam(params.booking_id);
  const sessionId = normalizeParam(params.session_id);

  let booking: any = null;
  let payment: any = null;

  if (bookingId) {
    const supabase = getSupabaseAdmin();

    const [{ data: bookingData }, { data: paymentData }] = await Promise.all([
      supabase
        .from('bookings')
        .select(
          `
          id,
          confirmation_code,
          guest_first_name,
          guest_last_name,
          guest_email,
          check_in_date,
          check_out_date,
          nights,
          status,
          payment_status,
          gross_amount,
          inventory_units (
            id,
            name,
            room_number,
            room_type
          )
        `
        )
        .eq('id', bookingId)
        .maybeSingle(),
      supabase
        .from('payments')
        .select(
          `
          provider_checkout_session_id,
          provider_payment_intent_id,
          amount_captured,
          currency,
          status,
          paid_at
        `
        )
        .eq('booking_id', bookingId)
        .order('paid_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    booking = bookingData ?? null;
    payment = paymentData ?? null;
  }

  const room = booking?.inventory_units
    ? Array.isArray(booking.inventory_units)
      ? booking.inventory_units[0]
      : booking.inventory_units
    : null;

  const guestName =
    booking?.guest_first_name || booking?.guest_last_name
      ? `${booking?.guest_first_name ?? ''} ${booking?.guest_last_name ?? ''}`.trim()
      : 'Guest';

  const roomLabel =
    room?.room_number && room?.name
      ? `${room.room_number} • ${room.name}`
      : room?.room_number
      ? `Room ${room.room_number}`
      : room?.name || room?.room_type || 'Your room';

  return (
    <div style={shellStyle}>
      <div style={containerStyle} className="space-y-6">
        <section style={heroStyle}>
          <div className="flex flex-col gap-5">
            <div
              style={{
                ...pillStyle,
                background: 'rgba(255,255,255,0.12)',
                color: '#ffffff',
                width: 'fit-content',
              }}
            >
              Reservation Confirmed
            </div>

            <div>
              <h1 className="text-4xl font-semibold tracking-tight">
                Thank you for booking with High Desert Lodge!
              </h1>
              <p
                className="mt-3 text-base"
                style={{ color: 'rgba(255,255,255,0.88)' }}
              >
                Your payment was received and your reservation has been confirmed.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link
                href="/book"
                style={{
                  ...actionLinkStyle,
                  background: '#ffffff',
                  color: '#0f172a',
                }}
              >
                Book Another Stay
              </Link>

              <Link
                href="/"
                style={{
                  ...actionLinkStyle,
                  background: 'rgba(255,255,255,0.10)',
                  color: '#ffffff',
                  border: '1px solid rgba(255,255,255,0.15)',
                }}
              >
                Back to Home
              </Link>
            </div>
          </div>
        </section>

        {booking ? (
          <>
            <section style={{ ...cardStyle, padding: '24px' }}>
              <div className="mb-5">
                <h2 className="text-lg font-semibold text-slate-900">
                  Reservation Summary
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  A confirmation email has also been sent to {booking.guest_email || 'your email'}.
                </p>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                    Guest
                  </p>
                  <p className="mt-1 text-base font-medium text-slate-900">
                    {guestName}
                  </p>
                </div>

                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                    Confirmation Code
                  </p>
                  <p className="mt-1 text-base font-medium text-slate-900">
                    #{booking.confirmation_code}
                  </p>
                </div>

                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                    Room
                  </p>
                  <p className="mt-1 text-base font-medium text-slate-900">
                    {roomLabel}
                  </p>
                </div>

                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                    Status
                  </p>
                  <div className="mt-1 flex flex-wrap gap-2">
                    <span
                      style={{
                        ...pillStyle,
                        background: '#ecfdf5',
                        color: '#047857',
                        border: '1px solid #a7f3d0',
                      }}
                    >
                      {booking.status || 'confirmed'}
                    </span>
                    <span
                      style={{
                        ...pillStyle,
                        background: '#eff6ff',
                        color: '#1d4ed8',
                        border: '1px solid #93c5fd',
                      }}
                    >
                      {booking.payment_status || 'paid'}
                    </span>
                  </div>
                </div>

                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                    Check-In
                  </p>
                  <p className="mt-1 text-base font-medium text-slate-900">
                    {formatDateLabel(booking.check_in_date)}
                  </p>
                </div>

                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                    Check-Out
                  </p>
                  <p className="mt-1 text-base font-medium text-slate-900">
                    {formatDateLabel(booking.check_out_date)}
                  </p>
                </div>

                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                    Length of Stay
                  </p>
                  <p className="mt-1 text-base font-medium text-slate-900">
                    {booking.nights} night{booking.nights === 1 ? '' : 's'}
                  </p>
                </div>

                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                    Total Paid
                  </p>
                  <p className="mt-1 text-base font-medium text-slate-900">
                    {formatMoney(payment?.amount_captured ?? booking.gross_amount)}
                  </p>
                </div>
              </div>
            </section>

            <section style={{ ...cardStyle, padding: '24px' }}>
              <h2 className="text-lg font-semibold text-slate-900">
                Payment Details
              </h2>
              <div className="mt-5 grid gap-4 md:grid-cols-3">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                    Checkout Session
                  </p>
                  <p className="mt-1 break-all text-sm text-slate-700">
                    {payment?.provider_checkout_session_id || sessionId || '—'}
                  </p>
                </div>

                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                    Payment Intent
                  </p>
                  <p className="mt-1 break-all text-sm text-slate-700">
                    {payment?.provider_payment_intent_id || '—'}
                  </p>
                </div>

                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                    Paid At
                  </p>
                  <p className="mt-1 text-sm text-slate-700">
                    {payment?.paid_at ? new Date(payment.paid_at).toLocaleString() : '—'}
                  </p>
                </div>
              </div>
            </section>
          </>
        ) : (
          <section style={{ ...cardStyle, padding: '24px' }}>
            <h2 className="text-lg font-semibold text-slate-900">
              Reservation Received
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              Your payment completed successfully. Your confirmation email should arrive shortly.
            </p>

            {bookingId ? (
              <p className="mt-4 text-sm text-slate-500">
                Booking ID: {bookingId}
              </p>
            ) : null}

            {sessionId ? (
              <p className="mt-2 text-sm text-slate-500">
                Session ID: {sessionId}
              </p>
            ) : null}
          </section>
        )}
      </div>
    </div>
  );
}