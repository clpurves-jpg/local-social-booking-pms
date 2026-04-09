import Link from 'next/link';
import { requireRole } from '@/lib/auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import {
  updateBookingDetails,
  refundBooking,
  createBookingPaymentLink,
} from '../../actions';

export const dynamic = 'force-dynamic';

type SearchParams = {
  [key: string]: string | string[] | undefined;
};

type BookingRow = {
  id: string;
  confirmation_code: string;
  guest_first_name: string;
  guest_last_name: string;
  guest_email: string;
  guest_phone: string | null;
  vehicle_plate: string | null;
  inventory_id: string;
  check_in_date: string;
  check_out_date: string;
  nights: number;
  status: string | null;
  payment_status: string | null;
  balance_due: number | null;
  gross_amount: number | null;
  refunded_amount: number | null;
  stripe_payment_intent_id: string | null;
  stripe_last_refund_id: string | null;
  stripe_last_refund_status: string | null;
  stripe_last_refund_reason: string | null;
  refunded_at: string | null;
  stripe_last_checkout_session_id: string | null;
  stripe_last_checkout_url: string | null;
  stripe_last_checkout_created_at: string | null;
  checked_in_at: string | null;
  checked_out_at: string | null;
  special_requests: string | null;
  internal_notes: string | null;
  created_at: string | null;
};

type InventoryUnitRow = {
  id: string;
  name: string | null;
  room_number: string | null;
  room_type: string | null;
  inventory_type_code: string | null;
  sort_order: number | null;
};

function normalizeParam(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? '' : value ?? '';
}

function formatDateTime(value: string | null) {
  if (!value) return '—';
  return new Date(value).toLocaleString();
}

function formatMoney(value: number | null) {
  if (value === null || value === undefined) return '—';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(value);
}

function getUnitLabel(unit: InventoryUnitRow): string {
  const roomNumber = unit.room_number?.trim();
  const name = unit.name?.trim();
  const type = unit.room_type?.trim();

  if (roomNumber && name) return `${roomNumber} • ${name}`;
  if (roomNumber) return `Room ${roomNumber}`;
  if (name) return name;
  if (type) return type;

  return 'Room';
}

const shellStyle: React.CSSProperties = {
  minHeight: '100vh',
  background: '#f8fafc',
};

const containerStyle: React.CSSProperties = {
  maxWidth: '1200px',
  margin: '0 auto',
  padding: '24px 16px 40px',
};

const heroStyle: React.CSSProperties = {
  borderRadius: '24px',
  padding: '28px',
  background:
    'linear-gradient(135deg, #0f172a 0%, #1e293b 55%, #334155 100%)',
  color: '#ffffff',
  boxShadow: '0 10px 30px rgba(15, 23, 42, 0.10)',
  border: '1px solid rgba(255,255,255,0.08)',
};

const cardStyle: React.CSSProperties = {
  background: '#ffffff',
  border: '1px solid #e2e8f0',
  borderRadius: '20px',
  boxShadow: '0 8px 24px rgba(15, 23, 42, 0.06)',
};

const actionLinkStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  borderRadius: '999px',
  padding: '10px 16px',
  fontSize: '14px',
  fontWeight: 600,
  textDecoration: 'none',
};

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '12px',
  fontWeight: 700,
  color: '#475569',
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
  marginBottom: '8px',
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  border: '1px solid #cbd5e1',
  borderRadius: '14px',
  padding: '12px 14px',
  background: '#ffffff',
  fontSize: '14px',
};

export default async function BookingDetailsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<SearchParams>;
}) {
  await requireRole(['desk', 'admin']);

  const { id } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const message = normalizeParam(resolvedSearchParams.message);
  const errorMessage = normalizeParam(resolvedSearchParams.error);

  const supabase = getSupabaseAdmin();

  const [
    { data: booking, error: bookingError },
    { data: units = [], error: unitsError },
  ] = await Promise.all([
    supabase
      .from('bookings')
      .select(`
        id,
        confirmation_code,
        guest_first_name,
        guest_last_name,
        guest_email,
        guest_phone,
        vehicle_plate,
        inventory_id,
        check_in_date,
        check_out_date,
        nights,
        status,
        payment_status,
        balance_due,
        gross_amount,
        refunded_amount,
        stripe_payment_intent_id,
        stripe_last_refund_id,
        stripe_last_refund_status,
        stripe_last_refund_reason,
        refunded_at,
        stripe_last_checkout_session_id,
        stripe_last_checkout_url,
        stripe_last_checkout_created_at,
        checked_in_at,
        checked_out_at,
        special_requests,
        internal_notes,
        created_at
      `)
      .eq('id', id)
      .single(),
    supabase
      .from('inventory_units')
      .select('id, name, room_number, room_type, inventory_type_code, sort_order')
      .order('sort_order', { ascending: true })
      .order('name', { ascending: true }),
  ]);

  if (bookingError || !booking) {
    throw new Error(`Failed to load booking: ${bookingError?.message || 'Not found'}`);
  }

  if (unitsError) {
    throw new Error(`Failed to load rooms: ${unitsError.message}`);
  }

  const typedBooking = booking as unknown as BookingRow;
  const typedUnits = units as InventoryUnitRow[];
  const refundableAmount = Math.max(
    0,
    Number(typedBooking.gross_amount ?? 0) - Number(typedBooking.refunded_amount ?? 0)
  );

  return (
    <div style={shellStyle}>
      <div style={containerStyle} className="space-y-6">
        <section style={heroStyle}>
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  borderRadius: '999px',
                  background: 'rgba(255,255,255,0.12)',
                  padding: '6px 12px',
                  fontSize: '12px',
                  fontWeight: 600,
                  marginBottom: '12px',
                }}
              >
                Booking Details
              </div>
              <h1 className="text-4xl font-semibold tracking-tight">
                #{typedBooking.confirmation_code}
              </h1>
              <p
                className="mt-2 text-base"
                style={{ color: 'rgba(255,255,255,0.85)' }}
              >
                View and update reservation details for this guest.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link
                href="/desk/bookings"
                style={{
                  ...actionLinkStyle,
                  background: '#ffffff',
                  color: '#0f172a',
                }}
              >
                Back to Bookings
              </Link>

              <Link
                href="/desk/rooms"
                style={{
                  ...actionLinkStyle,
                  background: 'rgba(255,255,255,0.10)',
                  color: '#ffffff',
                  border: '1px solid rgba(255,255,255,0.15)',
                }}
              >
                Rooms
              </Link>
              <Link
  href={`/desk/bookings/${typedBooking.id}/receipt`}
  style={{
    ...actionLinkStyle,
    background: 'rgba(255,255,255,0.10)',
    color: '#ffffff',
    border: '1px solid rgba(255,255,255,0.15)',
  }}
>
  Print Receipt
</Link>
            </div>
          </div>
        </section>

        {message ? (
          <div
            style={{
              ...cardStyle,
              padding: '16px 18px',
              background: '#ecfdf5',
              border: '1px solid #a7f3d0',
              color: '#047857',
            }}
          >
            {message}
          </div>
        ) : null}

        {errorMessage ? (
          <div
            style={{
              ...cardStyle,
              padding: '16px 18px',
              background: '#fff1f2',
              border: '1px solid #fda4af',
              color: '#be123c',
            }}
          >
            {errorMessage}
          </div>
        ) : null}

        <section className="grid gap-4 md:grid-cols-4">
          <div style={{ ...cardStyle, padding: '18px' }}>
            <p className="text-sm text-slate-500">Status</p>
            <p className="mt-2 text-xl font-semibold text-slate-900">
              {typedBooking.status || '—'}
            </p>
          </div>
          <div style={{ ...cardStyle, padding: '18px' }}>
            <p className="text-sm text-slate-500">Payment</p>
            <p className="mt-2 text-xl font-semibold text-slate-900">
              {typedBooking.payment_status || '—'}
            </p>
          </div>
          <div style={{ ...cardStyle, padding: '18px' }}>
            <p className="text-sm text-slate-500">Gross Amount</p>
            <p className="mt-2 text-xl font-semibold text-slate-900">
              {formatMoney(typedBooking.gross_amount)}
            </p>
          </div>
          <div style={{ ...cardStyle, padding: '18px' }}>
            <p className="text-sm text-slate-500">Refundable</p>
            <p className="mt-2 text-xl font-semibold text-slate-900">
              {formatMoney(refundableAmount)}
            </p>
          </div>
        </section>

        <section style={{ ...cardStyle, padding: '24px' }}>
          <div className="mb-5">
            <h2 className="text-lg font-semibold text-slate-900">Edit Booking</h2>
            <p className="mt-1 text-sm text-slate-500">
              Update guest details, stay dates, room assignment, and notes.
            </p>
          </div>

          <form
            action={updateBookingDetails.bind(null, typedBooking.id)}
            className="space-y-6"
          >
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label style={labelStyle}>First Name</label>
                <input
                  name="guest_first_name"
                  defaultValue={typedBooking.guest_first_name}
                  style={inputStyle}
                  required
                />
              </div>

              <div>
                <label style={labelStyle}>Last Name</label>
                <input
                  name="guest_last_name"
                  defaultValue={typedBooking.guest_last_name}
                  style={inputStyle}
                  required
                />
              </div>

              <div>
                <label style={labelStyle}>Email</label>
                <input
                  type="email"
                  name="guest_email"
                  defaultValue={typedBooking.guest_email}
                  style={inputStyle}
                  required
                />
              </div>

              <div>
                <label style={labelStyle}>Phone</label>
                <input
                  name="guest_phone"
                  defaultValue={typedBooking.guest_phone || ''}
                  style={inputStyle}
                />
              </div>
<div>
  <label style={labelStyle}>Vehicle License Plate</label>
  <input
    name="vehicle_plate"
    defaultValue={typedBooking.vehicle_plate || ''}
    style={inputStyle}
    placeholder="ABC1234"
  />
</div>
              <div>
                <label style={labelStyle}>Check-In Date</label>
                <input
                  type="date"
                  name="check_in_date"
                  defaultValue={typedBooking.check_in_date}
                  style={inputStyle}
                  required
                />
              </div>

              <div>
                <label style={labelStyle}>Check-Out Date</label>
                <input
                  type="date"
                  name="check_out_date"
                  defaultValue={typedBooking.check_out_date}
                  style={inputStyle}
                  required
                />
              </div>

              <div className="md:col-span-2">
                <label style={labelStyle}>Room Assignment</label>
                <select
                  name="inventory_id"
                  defaultValue={typedBooking.inventory_id}
                  style={inputStyle}
                  required
                >
                  {typedUnits.map((unit) => (
                    <option key={unit.id} value={unit.id}>
                      {getUnitLabel(unit)}
                    </option>
                  ))}
                </select>
              </div>

              <div className="md:col-span-2">
                <label style={labelStyle}>Special Requests</label>
                <textarea
                  name="special_requests"
                  defaultValue={typedBooking.special_requests || ''}
                  rows={4}
                  style={{ ...inputStyle, resize: 'vertical' }}
                />
              </div>

              <div className="md:col-span-2">
                <label style={labelStyle}>Internal Notes</label>
                <textarea
                  name="internal_notes"
                  defaultValue={typedBooking.internal_notes || ''}
                  rows={5}
                  style={{ ...inputStyle, resize: 'vertical' }}
                />
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                type="submit"
                style={{
                  borderRadius: '14px',
                  background: '#0f172a',
                  color: '#ffffff',
                  padding: '12px 18px',
                  fontSize: '14px',
                  fontWeight: 600,
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                Save Booking Changes
              </button>

              <Link
                href="/desk/bookings"
                style={{
                  ...actionLinkStyle,
                  background: '#ffffff',
                  color: '#334155',
                  border: '1px solid #cbd5e1',
                }}
              >
                Cancel
              </Link>
            </div>
          </form>
        </section>

        <section style={{ ...cardStyle, padding: '24px' }}>
          <div className="mb-5">
            <h2 className="text-lg font-semibold text-slate-900">Card Payment Link</h2>
            <p className="mt-1 text-sm text-slate-500">
              Create a Stripe-hosted payment page for this booking and share the link with the guest.
            </p>
          </div>

          <div className="space-y-5">
            <div className="grid gap-4 md:grid-cols-3">
              <div style={{ ...cardStyle, padding: '18px', boxShadow: 'none' }}>
                <p className="text-sm text-slate-500">Gross Amount</p>
                <p className="mt-2 text-lg font-semibold text-slate-900">
                  {formatMoney(typedBooking.gross_amount)}
                </p>
              </div>

              <div style={{ ...cardStyle, padding: '18px', boxShadow: 'none' }}>
                <p className="text-sm text-slate-500">Balance Due</p>
                <p className="mt-2 text-lg font-semibold text-slate-900">
                  {formatMoney(typedBooking.balance_due)}
                </p>
              </div>

              <div style={{ ...cardStyle, padding: '18px', boxShadow: 'none' }}>
                <p className="text-sm text-slate-500">Last Link Created</p>
                <p className="mt-2 text-sm font-medium text-slate-900">
                  {typedBooking.stripe_last_checkout_created_at
                    ? new Date(typedBooking.stripe_last_checkout_created_at).toLocaleString()
                    : '—'}
                </p>
              </div>
            </div>

            <form action={createBookingPaymentLink.bind(null, typedBooking.id)}>
              <button
                type="submit"
                style={{
                  borderRadius: '14px',
                  background: '#0f172a',
                  color: '#ffffff',
                  padding: '12px 18px',
                  fontSize: '14px',
                  fontWeight: 600,
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                Create Payment Link
              </button>
            </form>

            <div>
              <label style={labelStyle}>Last Payment Link</label>
              <input
                readOnly
                value={typedBooking.stripe_last_checkout_url || ''}
                placeholder="No payment link created yet"
                style={{
                  ...inputStyle,
                  background: '#f8fafc',
                  color: '#475569',
                }}
              />
            </div>

            {typedBooking.stripe_last_checkout_url ? (
              <div className="flex flex-wrap gap-3">
                <a
                  href={typedBooking.stripe_last_checkout_url}
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    ...actionLinkStyle,
                    background: '#ffffff',
                    color: '#0f172a',
                    border: '1px solid #cbd5e1',
                  }}
                >
                  Open Payment Link
                </a>
              </div>
            ) : null}
          </div>
        </section>

        <section style={{ ...cardStyle, padding: '24px' }}>
          <div className="mb-5">
            <h2 className="text-lg font-semibold text-slate-900">Refund Payment</h2>
            <p className="mt-1 text-sm text-slate-500">
              Process a Stripe refund for this booking.
            </p>
          </div>

          <form action={refundBooking.bind(null, typedBooking.id)} className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label style={labelStyle}>Refund Type</label>
                <select name="refund_type" defaultValue="full" style={inputStyle}>
                  <option value="full">Full Refund</option>
                  <option value="partial">Partial Refund</option>
                </select>
              </div>

              <div>
                <label style={labelStyle}>Reason</label>
                <select
                  name="refund_reason"
                  defaultValue="requested_by_customer"
                  style={inputStyle}
                >
                  <option value="requested_by_customer">Requested by Customer</option>
                  <option value="duplicate">Duplicate</option>
                  <option value="fraudulent">Fraudulent</option>
                </select>
              </div>

              <div>
                <label style={labelStyle}>Partial Refund Amount</label>
                <input
                  type="number"
                  name="refund_amount"
                  min="0.01"
                  step="0.01"
                  placeholder="Enter amount"
                  style={inputStyle}
                />
              </div>

              <div>
                <label style={labelStyle}>Payment Intent</label>
                <input
                  value={typedBooking.stripe_payment_intent_id || 'Not stored'}
                  readOnly
                  style={{
                    ...inputStyle,
                    background: '#f8fafc',
                    color: '#64748b',
                  }}
                />
              </div>
            </div>

            <button
              type="submit"
              style={{
                borderRadius: '14px',
                background: '#dc2626',
                color: '#ffffff',
                padding: '12px 18px',
                fontSize: '14px',
                fontWeight: 600,
                border: 'none',
                cursor: 'pointer',
              }}
            >
              Submit Refund
            </button>
          </form>
        </section>

        <section className="grid gap-4 md:grid-cols-4">
          <div style={{ ...cardStyle, padding: '18px' }}>
            <p className="text-sm text-slate-500">Created</p>
            <p className="mt-2 text-sm font-medium text-slate-900">
              {formatDateTime(typedBooking.created_at)}
            </p>
          </div>

          <div style={{ ...cardStyle, padding: '18px' }}>
            <p className="text-sm text-slate-500">Checked In</p>
            <p className="mt-2 text-sm font-medium text-slate-900">
              {formatDateTime(typedBooking.checked_in_at)}
            </p>
          </div>

          <div style={{ ...cardStyle, padding: '18px' }}>
            <p className="text-sm text-slate-500">Checked Out</p>
            <p className="mt-2 text-sm font-medium text-slate-900">
              {formatDateTime(typedBooking.checked_out_at)}
            </p>
          </div>

          <div style={{ ...cardStyle, padding: '18px' }}>
            <p className="text-sm text-slate-500">Refunded At</p>
            <p className="mt-2 text-sm font-medium text-slate-900">
              {formatDateTime(typedBooking.refunded_at)}
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}