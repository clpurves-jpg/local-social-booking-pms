import Link from 'next/link';
import BookingActionButton from '@/components/desk/BookingActionButton';
import {
  markRoomDirty,
  markRoomClean,
  markRoomInspected,
} from '../actions';
import { requireRole } from '@/lib/auth';
import { getSupabaseAdmin } from '@/lib/supabase';

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
  sort_order: number | null;
  room_status: 'clean' | 'dirty' | 'inspected' | null;
};

type ActiveBookingRow = {
  id: string;
  inventory_id: string | null;
  guest_first_name: string | null;
  guest_last_name: string | null;
  check_out_date: string;
  checked_in_at: string | null;
  checked_out_at: string | null;
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

function getGuestName(booking: ActiveBookingRow | undefined): string {
  if (!booking) return 'Vacant';
  const first = booking.guest_first_name?.trim() || '';
  const last = booking.guest_last_name?.trim() || '';
  const full = `${first} ${last}`.trim();
  return full || 'Guest';
}

function formatDateLabel(date: string | null | undefined): string {
  if (!date) return '—';
  const parsed = new Date(`${date}T12:00:00`);
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(parsed);
}

function roomStatusStyle(status: string | null): React.CSSProperties {
  switch ((status || 'clean').toLowerCase()) {
    case 'dirty':
      return {
        background: '#fff1f2',
        color: '#be123c',
        border: '1px solid #fda4af',
      };
    case 'inspected':
      return {
        background: '#eff6ff',
        color: '#1d4ed8',
        border: '1px solid #93c5fd',
      };
    case 'clean':
    default:
      return {
        background: '#ecfdf5',
        color: '#047857',
        border: '1px solid #a7f3d0',
      };
  }
}

const shellStyle: React.CSSProperties = {
  minHeight: '100vh',
  background: '#f8fafc',
};

const containerStyle: React.CSSProperties = {
  maxWidth: '1400px',
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

const softCardStyle: React.CSSProperties = {
  background: '#f8fafc',
  border: '1px solid #e2e8f0',
  borderRadius: '16px',
};

const pillStyle: React.CSSProperties = {
  borderRadius: '999px',
  padding: '4px 10px',
  fontSize: '12px',
  fontWeight: 600,
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

export default async function RoomsPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>;
}) {
  await requireRole(['desk', 'admin']);

  const params = searchParams ? await searchParams : {};
  const message = normalizeParam(params.message);
  const errorMessage = normalizeParam(params.error);

  const supabase = getSupabaseAdmin();

  const [
    { data: units = [], error: unitsError },
    { data: activeBookings = [], error: activeBookingsError },
  ] = await Promise.all([
    supabase
      .from('inventory_units')
      .select(
        'id, name, room_number, room_type, inventory_type_code, sort_order, room_status'
      )
      .order('sort_order', { ascending: true })
      .order('name', { ascending: true }),
    supabase
      .from('bookings')
      .select(
        'id, inventory_id, guest_first_name, guest_last_name, check_out_date, checked_in_at, checked_out_at'
      )
      .not('checked_in_at', 'is', null)
      .is('checked_out_at', null),
  ]);

  if (unitsError) {
    throw new Error(`Failed to load rooms: ${unitsError.message}`);
  }

  if (activeBookingsError) {
    throw new Error(`Failed to load active stays: ${activeBookingsError.message}`);
  }

  const typedUnits = units as InventoryUnitRow[];
  const typedBookings = activeBookings as ActiveBookingRow[];

  const activeBookingMap = new Map<string, ActiveBookingRow>();
  for (const booking of typedBookings) {
    if (booking.inventory_id) {
      activeBookingMap.set(booking.inventory_id, booking);
    }
  }

  const cleanCount = typedUnits.filter((u) => (u.room_status || 'clean') === 'clean').length;
  const dirtyCount = typedUnits.filter((u) => u.room_status === 'dirty').length;
  const inspectedCount = typedUnits.filter((u) => u.room_status === 'inspected').length;
  const occupiedCount = typedBookings.length;

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
                Desk Rooms
              </div>
              <h1 className="text-4xl font-semibold tracking-tight">Room Status</h1>
              <p
                className="mt-2 text-base"
                style={{ color: 'rgba(255,255,255,0.85)' }}
              >
                Track clean, dirty, and inspected rooms from one place.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link
                href="/desk"
                style={{
                  ...actionLinkStyle,
                  background: '#ffffff',
                  color: '#0f172a',
                }}
              >
                Back to Dashboard
              </Link>
              <Link
                href="/desk/bookings"
                style={{
                  ...actionLinkStyle,
                  background: 'rgba(255,255,255,0.10)',
                  color: '#ffffff',
                  border: '1px solid rgba(255,255,255,0.15)',
                }}
              >
                Bookings
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
            <p className="text-sm text-slate-500">Clean</p>
            <p className="mt-2 text-3xl font-semibold text-slate-900">{cleanCount}</p>
          </div>
          <div style={{ ...cardStyle, padding: '18px' }}>
            <p className="text-sm text-slate-500">Dirty</p>
            <p className="mt-2 text-3xl font-semibold text-slate-900">{dirtyCount}</p>
          </div>
          <div style={{ ...cardStyle, padding: '18px' }}>
            <p className="text-sm text-slate-500">Inspected</p>
            <p className="mt-2 text-3xl font-semibold text-slate-900">{inspectedCount}</p>
          </div>
          <div style={{ ...cardStyle, padding: '18px' }}>
            <p className="text-sm text-slate-500">Occupied</p>
            <p className="mt-2 text-3xl font-semibold text-slate-900">{occupiedCount}</p>
          </div>
        </section>

        <section style={{ ...cardStyle, padding: '24px' }}>
          <div className="mb-5">
            <h2 className="text-lg font-semibold text-slate-900">Rooms</h2>
            <p className="mt-1 text-sm text-slate-500">
              Check current status and update housekeeping progress.
            </p>
          </div>

          <div className="space-y-4">
            {typedUnits.map((unit) => {
              const activeBooking = activeBookingMap.get(unit.id);
              const status = unit.room_status || 'clean';

              return (
                <div key={unit.id} style={{ ...softCardStyle, padding: '18px' }}>
                  <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                        <div>
                          <p className="font-semibold text-slate-900">
                            {getUnitLabel(unit)}
                          </p>
                          <p className="mt-1 text-sm text-slate-500">
                            {unit.room_type || unit.inventory_type_code || 'Room'}
                          </p>

                          <div className="mt-3 flex flex-wrap gap-2">
                            <span style={{ ...pillStyle, ...roomStatusStyle(status) }}>
                              {status}
                            </span>
                            <span
                              style={{
                                ...pillStyle,
                                background: activeBooking ? '#eff6ff' : '#f8fafc',
                                color: activeBooking ? '#1d4ed8' : '#475569',
                                border: activeBooking
                                  ? '1px solid #93c5fd'
                                  : '1px solid #cbd5e1',
                              }}
                            >
                              {activeBooking ? 'Occupied' : 'Vacant'}
                            </span>
                          </div>
                        </div>

                        <div className="grid gap-2 text-sm text-slate-600 md:text-right">
                          <div>
                            <span className="font-medium text-slate-900">Guest:</span>{' '}
                            {getGuestName(activeBooking)}
                          </div>
                          <div>
                            <span className="font-medium text-slate-900">Departure:</span>{' '}
                            {activeBooking ? formatDateLabel(activeBooking.check_out_date) : '—'}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="grid gap-2 xl:w-52">
                      <BookingActionButton
                        label="Mark Dirty"
                        confirmTitle="Mark Room Dirty?"
                        confirmMessage={`Mark ${getUnitLabel(unit)} as dirty?`}
                        action={markRoomDirty.bind(null, unit.id)}
                        tone="red"
                      />

                      <BookingActionButton
                        label="Mark Clean"
                        confirmTitle="Mark Room Clean?"
                        confirmMessage={`Mark ${getUnitLabel(unit)} as clean?`}
                        action={markRoomClean.bind(null, unit.id)}
                        tone="green"
                      />

                      <BookingActionButton
                        label="Mark Inspected"
                        confirmTitle="Mark Room Inspected?"
                        confirmMessage={`Mark ${getUnitLabel(unit)} as inspected?`}
                        action={markRoomInspected.bind(null, unit.id)}
                        tone="blue"
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}