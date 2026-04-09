import Link from 'next/link';
import { requireRole } from '@/lib/auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { createDeskBooking } from './actions';

export const dynamic = 'force-dynamic';

type SearchParams = {
  [key: string]: string | string[] | undefined;
};

type InventoryUnitRow = {
  id: string;
  name: string | null;
  room_number: string | null;
  room_type: string | null;
  inventory_type_code: string | null;
  room_status: 'clean' | 'dirty' | 'inspected' | null;
  sort_order: number | null;
};

function normalizeParam(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? '' : value ?? '';
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

function getTomorrow() {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  return date.toISOString().slice(0, 10);
}

const shellStyle: React.CSSProperties = {
  minHeight: '100vh',
  background: '#f8fafc',
};

const containerStyle: React.CSSProperties = {
  maxWidth: '1100px',
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

export default async function DeskNewBookingPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>;
}) {
  await requireRole(['desk', 'admin']);

  const params = searchParams ? await searchParams : {};
  const message = normalizeParam(params.message);
  const errorMessage = normalizeParam(params.error);

  const supabase = getSupabaseAdmin();

  const { data: units = [], error: unitsError } = await supabase
    .from('inventory_units')
    .select('id, name, room_number, room_type, inventory_type_code, room_status, sort_order')
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true });

  if (unitsError) {
    throw new Error(`Failed to load rooms: ${unitsError.message}`);
  }

  const typedUnits = units as InventoryUnitRow[];
  const today = new Date().toISOString().slice(0, 10);
  const tomorrow = getTomorrow();

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
                Desk Booking
              </div>
              <h1 className="text-4xl font-semibold tracking-tight">New Booking</h1>
              <p
                className="mt-2 text-base"
                style={{ color: 'rgba(255,255,255,0.85)' }}
              >
                Create a walk-in, phone, or manual reservation from the front desk.
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

        <section style={{ ...cardStyle, padding: '24px' }}>
          <div className="mb-5">
            <h2 className="text-lg font-semibold text-slate-900">Reservation Details</h2>
            <p className="mt-1 text-sm text-slate-500">
              Guest email is optional for walk-ins. If left blank, the system will create a desk-only placeholder email so the reservation can still be saved.
            </p>
          </div>

          <form action={createDeskBooking} className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label style={labelStyle}>First Name</label>
                <input name="guest_first_name" style={inputStyle} required />
              </div>

              <div>
                <label style={labelStyle}>Last Name</label>
                <input name="guest_last_name" style={inputStyle} required />
              </div>

              <div>
                <label style={labelStyle}>Email (Optional for Walk-Ins)</label>
                <input
                  type="email"
                  name="guest_email"
                  style={inputStyle}
                  placeholder="Leave blank for walk-in without email"
                />
              </div>

              <div>
                <label style={labelStyle}>Phone</label>
                <input name="guest_phone" style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Vehicle License Plate (Optional)</label>
                <input
                  name="vehicle_plate"
                  style={inputStyle}
                  placeholder="ABC1234"
               />
              </div>
              <div>
                <label style={labelStyle}>Check-In Date</label>
                <input
                  type="date"
                  name="check_in_date"
                  defaultValue={today}
                  style={inputStyle}
                  required
                />
              </div>

              <div>
                <label style={labelStyle}>Check-Out Date</label>
                <input
                  type="date"
                  name="check_out_date"
                  defaultValue={tomorrow}
                  style={inputStyle}
                  required
                />
              </div>

              <div className="md:col-span-2">
                <label style={labelStyle}>Room</label>
                <select name="inventory_id" style={inputStyle} required>
                  <option value="">Select a room</option>
                  {typedUnits.map((unit) => (
                    <option key={unit.id} value={unit.id}>
                      {getUnitLabel(unit)} • Status: {unit.room_status || 'clean'}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={labelStyle}>Nightly Rate</label>
                <input
                  type="number"
                  name="nightly_rate"
                  min="0.01"
                  step="0.01"
                  placeholder="95.00"
                  style={inputStyle}
                  required
                />
              </div>

              <div>
                <label style={labelStyle}>Booking Source</label>
                <select name="source" defaultValue="walk_in" style={inputStyle} required>
                  <option value="walk_in">Walk-In</option>
                  <option value="phone">Phone</option>
                  <option value="admin">Admin</option>
                </select>
              </div>

              <div>
                <label style={labelStyle}>Payment Option</label>
                <select
                  name="payment_option"
                  defaultValue="pay_at_property"
                  style={inputStyle}
                  required
                >
                  <option value="pay_at_property">Pay at Property</option>
                  <option value="unpaid">Unpaid / Hold Balance</option>
                  <option value="paid_cash">Paid Cash at Desk</option>
                  <option value="comp">Comp Booking</option>
                </select>
              </div>

              <div
                style={{
                  display: 'flex',
                  alignItems: 'flex-end',
                }}
              >
                <label
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    fontSize: '14px',
                    color: '#0f172a',
                    fontWeight: 500,
                  }}
                >
                  <input type="checkbox" name="check_in_now" />
                  Check guest in immediately
                </label>
              </div>

              <div className="md:col-span-2">
                <label style={labelStyle}>Special Requests</label>
                <textarea
                  name="special_requests"
                  rows={4}
                  style={{ ...inputStyle, resize: 'vertical' }}
                />
              </div>

              <div className="md:col-span-2">
                <label style={labelStyle}>Internal Notes</label>
                <textarea
                  name="internal_notes"
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
                Create Booking
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
      </div>
    </div>
  );
}