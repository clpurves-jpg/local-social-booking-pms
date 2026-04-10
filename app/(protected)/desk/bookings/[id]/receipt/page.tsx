import Link from 'next/link';
import PrintPageButton from '@/components/desk/PrintPageButton';
import { requireRole } from '@/lib/auth';
import { getSupabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

type BookingRow = {
  id: string;
  confirmation_code: string;
  guest_first_name: string;
  guest_last_name: string;
  guest_email: string;
  guest_phone: string | null;
  check_in_date: string;
  check_out_date: string;
  nights: number;
  status: string | null;
  payment_status: string | null;
  balance_due: number | null;
  gross_amount: number | null;
  refunded_amount: number | null;
  created_at: string | null;
  inventory_units:
    | {
        id: string;
        name: string | null;
        room_number: string | null;
        room_type: string | null;
      }
    | {
        id: string;
        name: string | null;
        room_number: string | null;
        room_type: string | null;
      }[]
    | null;
};

function formatDateLabel(date: string | null | undefined) {
  if (!date) return '—';
  const parsed = new Date(`${date}T12:00:00`);
  return new Intl.DateTimeFormat('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(parsed);
}

function formatDateTime(value: string | null) {
  if (!value) return '—';
  return new Date(value).toLocaleString();
}

function formatMoney(value: number | null | undefined) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(Number(value ?? 0));
}

export default async function DeskBookingReceiptPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRole(['desk', 'admin']);

  const { id } = await params;
  const supabase = getSupabaseAdmin();

  const { data: booking, error } = await supabase
    .from('bookings')
    .select(
      `
      id,
      confirmation_code,
      guest_first_name,
      guest_last_name,
      guest_email,
      guest_phone,
      check_in_date,
      check_out_date,
      nights,
      status,
      payment_status,
      balance_due,
      gross_amount,
      refunded_amount,
      created_at,
      inventory_units (
        id,
        name,
        room_number,
        room_type
      )
    `
    )
    .eq('id', id)
    .single();

  if (error || !booking) {
    throw new Error(`Failed to load booking receipt: ${error?.message || 'Not found'}`);
  }

  const typedBooking = booking as BookingRow;
  const room = Array.isArray(typedBooking.inventory_units)
    ? typedBooking.inventory_units[0]
    : typedBooking.inventory_units;

  const guestName = `${typedBooking.guest_first_name} ${typedBooking.guest_last_name}`.trim();

  const roomLabel =
    room?.room_number && room?.name
      ? `${room.room_number} • ${room.name}`
      : room?.room_number
      ? `Room ${room.room_number}`
      : room?.name || room?.room_type || 'Room';

  const displayEmail = typedBooking.guest_email.startsWith('walkin+')
    ? 'Walk-in guest (no email provided)'
    : typedBooking.guest_email;

  return (
    <html>
      <head>
        <title>Receipt #{typedBooking.confirmation_code}</title>
      </head>
      <body
        style={{
          margin: 0,
          background: '#f8fafc',
          color: '#0f172a',
          fontFamily: 'Arial, sans-serif',
        }}
      >
        <div
          style={{
            maxWidth: '860px',
            margin: '0 auto',
            padding: '24px 16px 48px',
          }}
        >
          <div
            style={{
              display: 'flex',
              gap: '12px',
              marginBottom: '18px',
            }}
          >
            <Link
              href={`/desk/bookings/${typedBooking.id}`}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: '999px',
                padding: '10px 16px',
                fontSize: '14px',
                fontWeight: 600,
                textDecoration: 'none',
                background: '#ffffff',
                color: '#334155',
                border: '1px solid #cbd5e1',
              }}
            >
              Back to Booking
            </Link>
<PrintPageButton />
          </div>

          <div
            style={{
              background: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: '20px',
              boxShadow: '0 8px 24px rgba(15, 23, 42, 0.06)',
              padding: '28px',
            }}
          >
            <div
              style={{
                borderBottom: '1px solid #e2e8f0',
                paddingBottom: '18px',
                marginBottom: '24px',
              }}
            >
              <h1
                style={{
                  margin: 0,
                  fontSize: '28px',
                  fontWeight: 700,
                }}
              >
                High Desert Lodge
              </h1>
              <p style={{ marginTop: '8px', marginBottom: 0, color: '#475569' }}>
                Booking Receipt
              </p>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                gap: '18px',
                marginBottom: '28px',
              }}
            >
              <div>
                <div style={{ fontSize: '12px', color: '#64748b', textTransform: 'uppercase', fontWeight: 700 }}>
                  Confirmation
                </div>
                <div style={{ marginTop: '6px', fontSize: '18px', fontWeight: 700 }}>
                  #{typedBooking.confirmation_code}
                </div>
              </div>

              <div>
                <div style={{ fontSize: '12px', color: '#64748b', textTransform: 'uppercase', fontWeight: 700 }}>
                  Created
                </div>
                <div style={{ marginTop: '6px', fontSize: '16px', fontWeight: 600 }}>
                  {formatDateTime(typedBooking.created_at)}
                </div>
              </div>

              <div>
                <div style={{ fontSize: '12px', color: '#64748b', textTransform: 'uppercase', fontWeight: 700 }}>
                  Guest
                </div>
                <div style={{ marginTop: '6px', fontSize: '16px', fontWeight: 600 }}>
                  {guestName}
                </div>
              </div>

              <div>
                <div style={{ fontSize: '12px', color: '#64748b', textTransform: 'uppercase', fontWeight: 700 }}>
                  Email
                </div>
                <div style={{ marginTop: '6px', fontSize: '16px', fontWeight: 600 }}>
                  {displayEmail}
                </div>
              </div>

              <div>
                <div style={{ fontSize: '12px', color: '#64748b', textTransform: 'uppercase', fontWeight: 700 }}>
                  Phone
                </div>
                <div style={{ marginTop: '6px', fontSize: '16px', fontWeight: 600 }}>
                  {typedBooking.guest_phone || '—'}
                </div>
              </div>

              <div>
                <div style={{ fontSize: '12px', color: '#64748b', textTransform: 'uppercase', fontWeight: 700 }}>
                  Room
                </div>
                <div style={{ marginTop: '6px', fontSize: '16px', fontWeight: 600 }}>
                  {roomLabel}
                </div>
              </div>

              <div>
                <div style={{ fontSize: '12px', color: '#64748b', textTransform: 'uppercase', fontWeight: 700 }}>
                  Check-In
                </div>
                <div style={{ marginTop: '6px', fontSize: '16px', fontWeight: 600 }}>
                  {formatDateLabel(typedBooking.check_in_date)}
                </div>
              </div>

              <div>
                <div style={{ fontSize: '12px', color: '#64748b', textTransform: 'uppercase', fontWeight: 700 }}>
                  Check-Out
                </div>
                <div style={{ marginTop: '6px', fontSize: '16px', fontWeight: 600 }}>
                  {formatDateLabel(typedBooking.check_out_date)}
                </div>
              </div>

              <div>
                <div style={{ fontSize: '12px', color: '#64748b', textTransform: 'uppercase', fontWeight: 700 }}>
                  Nights
                </div>
                <div style={{ marginTop: '6px', fontSize: '16px', fontWeight: 600 }}>
                  {typedBooking.nights}
                </div>
              </div>

              <div>
                <div style={{ fontSize: '12px', color: '#64748b', textTransform: 'uppercase', fontWeight: 700 }}>
                  Status
                </div>
                <div style={{ marginTop: '6px', fontSize: '16px', fontWeight: 600 }}>
                  {typedBooking.status || '—'}
                </div>
              </div>
            </div>

            <div
              style={{
                borderTop: '1px solid #e2e8f0',
                paddingTop: '20px',
              }}
            >
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr auto',
                  gap: '12px',
                  marginBottom: '10px',
                }}
              >
                <div style={{ color: '#475569' }}>Room Total</div>
                <div style={{ fontWeight: 600 }}>{formatMoney(typedBooking.gross_amount)}</div>
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr auto',
                  gap: '12px',
                  marginBottom: '10px',
                }}
              >
                <div style={{ color: '#475569' }}>Refunded</div>
                <div style={{ fontWeight: 600 }}>{formatMoney(typedBooking.refunded_amount)}</div>
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr auto',
                  gap: '12px',
                  marginBottom: '10px',
                }}
              >
                <div style={{ color: '#475569' }}>Balance Due</div>
                <div style={{ fontWeight: 600 }}>{formatMoney(typedBooking.balance_due)}</div>
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr auto',
                  gap: '12px',
                  marginTop: '18px',
                  paddingTop: '16px',
                  borderTop: '1px solid #e2e8f0',
                  fontSize: '20px',
                  fontWeight: 700,
                }}
              >
                <div>Payment Status</div>
                <div>{typedBooking.payment_status || '—'}</div>
              </div>
            </div>
          </div>
        </div>
      </body>
    </html>
  );
}