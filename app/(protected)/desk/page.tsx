import Link from 'next/link';

import { requireRole } from '@/lib/auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { checkInBooking, checkOutBooking } from './actions';

export const dynamic = 'force-dynamic';

type BookingRow = {
  id: string;
  confirmation_code: string | null;
  guest_first_name: string | null;
  guest_last_name: string | null;
  guest_email: string | null;
  guest_phone: string | null;
  inventory_id: string | null;
  check_in_date: string;
  check_out_date: string;
  nights: number | null;
  status: string | null;
  payment_status: string | null;
  balance_due: number | null;
  checked_in_at: string | null;
  checked_out_at: string | null;
  special_requests: string | null;
  created_at: string | null;
};

type InventoryUnitRow = {
  id: string;
  name: string | null;
  room_number?: string | null;
  room_type?: string | null;
  inventory_type_code?: string | null;
  sort_order?: number | null;
};

function getBoiseToday(): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Boise',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());

  const year = parts.find((p) => p.type === 'year')?.value ?? '0000';
  const month = parts.find((p) => p.type === 'month')?.value ?? '00';
  const day = parts.find((p) => p.type === 'day')?.value ?? '00';

  return `${year}-${month}-${day}`;
}

function getGuestName(booking: BookingRow): string {
  const first = booking.guest_first_name?.trim() || '';
  const last = booking.guest_last_name?.trim() || '';
  const full = `${first} ${last}`.trim();

  return full || booking.guest_email || 'Guest';
}

function getGuestInitials(booking: BookingRow): string {
  const first = booking.guest_first_name?.trim()?.[0] || '';
  const last = booking.guest_last_name?.trim()?.[0] || '';
  return `${first}${last}`.toUpperCase() || 'G';
}

function getUnitLabel(
  booking: BookingRow,
  inventoryMap: Map<string, InventoryUnitRow>
): string {
  if (!booking.inventory_id) return 'Unassigned';

  const unit = inventoryMap.get(booking.inventory_id);
  if (!unit) return 'Assigned';

  const roomNumber = unit.room_number?.trim();
  const name = unit.name?.trim();
  const type = unit.room_type?.trim();

  if (roomNumber && name) return `${roomNumber} • ${name}`;
  if (roomNumber) return `Room ${roomNumber}`;
  if (name) return name;
  if (type) return type;

  return 'Assigned';
}

function formatDateLabel(date: string): string {
  const parsed = new Date(`${date}T12:00:00`);
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  }).format(parsed);
}

function formatNights(nights: number | null): string {
  if (!nights || nights <= 0) return '—';
  return `${nights} night${nights === 1 ? '' : 's'}`;
}

function formatMoney(value: number | null): string {
  if (value === null || value === undefined) return '—';

  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(value);
}

function paymentBadgeStyle(paymentStatus: string | null): React.CSSProperties {
  switch ((paymentStatus || '').toLowerCase()) {
    case 'paid':
      return {
        background: '#ecfdf5',
        color: '#047857',
        border: '1px solid #a7f3d0',
      };
    case 'partial':
    case 'partially_paid':
      return {
        background: '#fffbeb',
        color: '#b45309',
        border: '1px solid #fcd34d',
      };
    case 'unpaid':
      return {
        background: '#fff1f2',
        color: '#be123c',
        border: '1px solid #fda4af',
      };
    default:
      return {
        background: '#f1f5f9',
        color: '#334155',
        border: '1px solid #cbd5e1',
      };
  }
}

const shellStyle: React.CSSProperties = {
  minHeight: '100vh',
  background: '#f8fafc',
};

const containerStyle: React.CSSProperties = {
  maxWidth: '1280px',
  margin: '0 auto',
  padding: '24px 16px 40px',
};

const heroStyle: React.CSSProperties = {
  borderRadius: '24px',
  padding: '32px',
  background:
    'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #334155 100%)',
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

const actionButtonStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  borderRadius: '999px',
  padding: '10px 16px',
  fontSize: '14px',
  fontWeight: 600,
  textDecoration: 'none',
};

const summaryPillStyle: React.CSSProperties = {
  borderRadius: '999px',
  padding: '4px 10px',
  fontSize: '12px',
  fontWeight: 600,
};

function EmptyState({ message }: { message: string }) {
  return (
    <div
      className="px-4 py-10 text-center text-sm text-slate-500"
      style={{
        background: '#f8fafc',
        border: '1px dashed #cbd5e1',
        borderRadius: '16px',
      }}
    >
      {message}
    </div>
  );
}

export default async function DeskDashboardPage() {
  await requireRole(['desk', 'admin']);

  const supabase = getSupabaseAdmin();
  const today = getBoiseToday();

  const arrivalsQuery = supabase
    .from('bookings')
    .select(
      `
      id,
      confirmation_code,
      guest_first_name,
      guest_last_name,
      guest_email,
      guest_phone,
      inventory_id,
      check_in_date,
      check_out_date,
      nights,
      status,
      payment_status,
      balance_due,
      checked_in_at,
      checked_out_at,
      special_requests,
      created_at
    `
    )
    .eq('check_in_date', today)
    .is('checked_in_at', null)
    .is('checked_out_at', null)
    .neq('status', 'cancelled')
    .order('created_at', { ascending: false });

  const departuresQuery = supabase
    .from('bookings')
    .select(
      `
      id,
      confirmation_code,
      guest_first_name,
      guest_last_name,
      guest_email,
      guest_phone,
      inventory_id,
      check_in_date,
      check_out_date,
      nights,
      status,
      payment_status,
      balance_due,
      checked_in_at,
      checked_out_at,
      special_requests,
      created_at
    `
    )
    .eq('check_out_date', today)
    .not('checked_in_at', 'is', null)
    .is('checked_out_at', null)
    .neq('status', 'cancelled')
    .order('created_at', { ascending: false });

  const inHouseQuery = supabase
    .from('bookings')
    .select(
      `
      id,
      confirmation_code,
      guest_first_name,
      guest_last_name,
      guest_email,
      guest_phone,
      inventory_id,
      check_in_date,
      check_out_date,
      nights,
      status,
      payment_status,
      balance_due,
      checked_in_at,
      checked_out_at,
      special_requests,
      created_at
    `
    )
    .not('checked_in_at', 'is', null)
    .is('checked_out_at', null)
    .neq('status', 'cancelled')
    .order('check_in_date', { ascending: true });

  const unitsQuery = supabase
    .from('inventory_units')
    .select('id, name, room_number, room_type, inventory_type_code, sort_order')
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true });

  const [
    { data: arrivals = [], error: arrivalsError },
    { data: departures = [], error: departuresError },
    { data: inHouse = [], error: inHouseError },
    { data: units = [], error: unitsError },
  ] = await Promise.all([
    arrivalsQuery,
    departuresQuery,
    inHouseQuery,
    unitsQuery,
  ]);

  if (arrivalsError) {
    throw new Error(`Failed to load arrivals: ${arrivalsError.message}`);
  }
  if (departuresError) {
    throw new Error(`Failed to load departures: ${departuresError.message}`);
  }
  if (inHouseError) {
    throw new Error(`Failed to load in-house guests: ${inHouseError.message}`);
  }
  if (unitsError) {
    throw new Error(`Failed to load room inventory: ${unitsError.message}`);
  }

  const typedArrivals = arrivals as BookingRow[];
  const typedDepartures = departures as BookingRow[];
  const typedInHouse = inHouse as BookingRow[];
  const typedUnits = units as InventoryUnitRow[];

  const inventoryMap = new Map<string, InventoryUnitRow>(
    typedUnits.map((unit) => [unit.id, unit])
  );

  const occupiedUnitIds = new Set(
    typedInHouse
      .map((booking) => booking.inventory_id)
      .filter((value): value is string => Boolean(value))
  );

  const occupiedCount = occupiedUnitIds.size;
  const totalUnits = typedUnits.length;
  const vacantCount = Math.max(totalUnits - occupiedCount, 0);

  const roomTypeSummary = typedUnits.reduce<Record<string, number>>((acc, unit) => {
    const key =
      unit.room_type?.trim() ||
      unit.inventory_type_code?.trim() ||
      'Other';
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});

  const roomTypeEntries = Object.entries(roomTypeSummary).sort((a, b) =>
    a[0].localeCompare(b[0])
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
                Front Desk
              </div>
              <h1 className="text-4xl font-semibold tracking-tight">
                Front Desk Dashboard
              </h1>
              <p
                className="mt-2 text-base"
                style={{ color: 'rgba(255,255,255,0.85)' }}
              >
                Live overview for {formatDateLabel(today)}.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link
                href="/desk/bookings"
                style={{
                  ...actionButtonStyle,
                  background: '#ffffff',
                  color: '#0f172a',
                }}
              >
                View Bookings
              </Link>
              <Link
                href="/desk/rooms"
                style={{
                  ...actionButtonStyle,
                  background: 'rgba(255,255,255,0.10)',
                  color: '#ffffff',
                  border: '1px solid rgba(255,255,255,0.15)',
                }}
              >
                View Rooms
              </Link>
              <Link
                href="/admin/calendar"
                style={{
                  ...actionButtonStyle,
                  background: 'rgba(255,255,255,0.10)',
                  color: '#ffffff',
                  border: '1px solid rgba(255,255,255,0.15)',
                }}
              >
                Calendar
              </Link>
            </div>
          </div>
        </section>

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <div style={{ ...cardStyle, padding: '20px' }}>
            <p className="text-sm font-medium text-slate-500">Today’s Arrivals</p>
            <div className="mt-3 flex items-end justify-between">
              <p className="text-3xl font-semibold text-slate-900">
                {typedArrivals.length}
              </p>
              <span
                style={{
                  ...summaryPillStyle,
                  background: '#ecfdf5',
                  color: '#047857',
                }}
              >
                Check-ins
              </span>
            </div>
          </div>

          <div style={{ ...cardStyle, padding: '20px' }}>
            <p className="text-sm font-medium text-slate-500">Today’s Departures</p>
            <div className="mt-3 flex items-end justify-between">
              <p className="text-3xl font-semibold text-slate-900">
                {typedDepartures.length}
              </p>
              <span
                style={{
                  ...summaryPillStyle,
                  background: '#fffbeb',
                  color: '#b45309',
                }}
              >
                Check-outs
              </span>
            </div>
          </div>

          <div style={{ ...cardStyle, padding: '20px' }}>
            <p className="text-sm font-medium text-slate-500">In-House Guests</p>
            <div className="mt-3 flex items-end justify-between">
              <p className="text-3xl font-semibold text-slate-900">
                {typedInHouse.length}
              </p>
              <span
                style={{
                  ...summaryPillStyle,
                  background: '#eff6ff',
                  color: '#1d4ed8',
                }}
              >
                Active stays
              </span>
            </div>
          </div>

          <div style={{ ...cardStyle, padding: '20px' }}>
            <p className="text-sm font-medium text-slate-500">Occupied Rooms</p>
            <div className="mt-3 flex items-end justify-between">
              <p className="text-3xl font-semibold text-slate-900">
                {occupiedCount}
                <span className="ml-2 text-base font-medium text-slate-500">
                  / {totalUnits}
                </span>
              </p>
              <span
                style={{
                  ...summaryPillStyle,
                  background: '#f1f5f9',
                  color: '#334155',
                }}
              >
                Live
              </span>
            </div>
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-12">
          <div className="xl:col-span-4" style={{ ...cardStyle, padding: '24px' }}>
            <h2 className="text-lg font-semibold text-slate-900">
              Room Status Overview
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Snapshot of current inventory usage.
            </p>

            <div className="mt-5 grid grid-cols-2 gap-3">
              <div style={{ ...softCardStyle, padding: '16px' }}>
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                  Total Units
                </p>
                <p className="mt-2 text-2xl font-semibold text-slate-900">
                  {totalUnits}
                </p>
              </div>
              <div style={{ ...softCardStyle, padding: '16px' }}>
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                  Vacant
                </p>
                <p className="mt-2 text-2xl font-semibold text-slate-900">
                  {vacantCount}
                </p>
              </div>
              <div style={{ ...softCardStyle, padding: '16px' }}>
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                  Arrivals
                </p>
                <p className="mt-2 text-2xl font-semibold text-slate-900">
                  {typedArrivals.length}
                </p>
              </div>
              <div style={{ ...softCardStyle, padding: '16px' }}>
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                  Departures
                </p>
                <p className="mt-2 text-2xl font-semibold text-slate-900">
                  {typedDepartures.length}
                </p>
              </div>
            </div>

            {roomTypeEntries.length > 0 && (
              <div className="mt-6 border-t border-slate-200 pt-5">
                <h3 className="text-sm font-semibold text-slate-900">Inventory Mix</h3>
                <div className="mt-3 space-y-2">
                  {roomTypeEntries.map(([label, count]) => (
                    <div
                      key={label}
                      style={{
                        ...softCardStyle,
                        padding: '10px 12px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                      }}
                    >
                      <span className="text-sm text-slate-700">{label}</span>
                      <span
                        style={{
                          ...summaryPillStyle,
                          background: '#f1f5f9',
                          color: '#334155',
                        }}
                      >
                        {count}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="xl:col-span-4" style={{ ...cardStyle, padding: '24px' }}>
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">
                  Today’s Arrivals
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Guests scheduled to check in today.
                </p>
              </div>
              <Link
                href="/desk/bookings"
                className="text-sm font-medium text-slate-700 hover:text-slate-900"
              >
                All bookings
              </Link>
            </div>

            <div className="mt-5 space-y-3">
              {typedArrivals.length === 0 ? (
                <EmptyState message="No arrivals scheduled for today." />
              ) : (
                typedArrivals.slice(0, 8).map((booking) => (
                  <div
                    key={booking.id}
                    style={{ ...softCardStyle, padding: '16px' }}
                  >
                    <div className="flex items-start gap-3">
                      <div
                        style={{
                          width: '44px',
                          height: '44px',
                          borderRadius: '999px',
                          background: '#0f172a',
                          color: '#ffffff',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '14px',
                          fontWeight: 700,
                          flexShrink: 0,
                        }}
                      >
                        {getGuestInitials(booking)}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div className="min-w-0">
                            <p className="truncate font-semibold text-slate-900">
                              {getGuestName(booking)}
                            </p>
                            <p className="mt-1 text-sm text-slate-500">
                              {getUnitLabel(booking, inventoryMap)}
                            </p>
                          </div>

                          <div className="flex flex-wrap gap-2">
                            <span
                              style={{
                                ...summaryPillStyle,
                                background: '#ffffff',
                                color: '#334155',
                                border: '1px solid #e2e8f0',
                              }}
                            >
                              {formatNights(booking.nights)}
                            </span>
                            <span
                              style={{
                                ...paymentBadgeStyle(booking.payment_status),
                                borderRadius: '999px',
                                padding: '4px 10px',
                                fontSize: '12px',
                                fontWeight: 600,
                              }}
                            >
                              {booking.payment_status || 'Unknown'}
                            </span>
                          </div>
                        </div>

                        {(booking.guest_email || booking.guest_phone) && (
                          <div className="mt-3 space-y-1 text-xs text-slate-500">
                            {booking.guest_email ? <div>{booking.guest_email}</div> : null}
                            {booking.guest_phone ? <div>{booking.guest_phone}</div> : null}
                          </div>
                        )}

                        <div className="mt-3 flex items-center justify-between gap-3">
                          <div className="text-xs text-slate-500">
                            Balance:{' '}
                            <span className="font-medium text-slate-700">
                              {formatMoney(booking.balance_due)}
                            </span>
                          </div>

                          <form action={checkInBooking.bind(null, booking.id)}>
                            <button
                              type="submit"
                              style={{
                                borderRadius: '12px',
                                background: '#059669',
                                color: '#ffffff',
                                padding: '10px 16px',
                                fontSize: '14px',
                                fontWeight: 600,
                                border: 'none',
                                cursor: 'pointer',
                              }}
                            >
                              Check In
                            </button>
                          </form>
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="xl:col-span-4" style={{ ...cardStyle, padding: '24px' }}>
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">
                  Today’s Departures
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Guests scheduled to check out today.
                </p>
              </div>
              <Link
                href="/desk/bookings"
                className="text-sm font-medium text-slate-700 hover:text-slate-900"
              >
                All bookings
              </Link>
            </div>

            <div className="mt-5 space-y-3">
              {typedDepartures.length === 0 ? (
                <EmptyState message="No departures scheduled for today." />
              ) : (
                typedDepartures.slice(0, 8).map((booking) => (
                  <div
                    key={booking.id}
                    style={{ ...softCardStyle, padding: '16px' }}
                  >
                    <div className="flex items-start gap-3">
                      <div
                        style={{
                          width: '44px',
                          height: '44px',
                          borderRadius: '999px',
                          background: '#f59e0b',
                          color: '#ffffff',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '14px',
                          fontWeight: 700,
                          flexShrink: 0,
                        }}
                      >
                        {getGuestInitials(booking)}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div className="min-w-0">
                            <p className="truncate font-semibold text-slate-900">
                              {getGuestName(booking)}
                            </p>
                            <p className="mt-1 text-sm text-slate-500">
                              {getUnitLabel(booking, inventoryMap)}
                            </p>
                          </div>

                          <div className="flex flex-wrap gap-2">
                            <span
                              style={{
                                ...summaryPillStyle,
                                background: '#ffffff',
                                color: '#334155',
                                border: '1px solid #e2e8f0',
                              }}
                            >
                              {formatNights(booking.nights)}
                            </span>
                            <span
                              style={{
                                ...paymentBadgeStyle(booking.payment_status),
                                borderRadius: '999px',
                                padding: '4px 10px',
                                fontSize: '12px',
                                fontWeight: 600,
                              }}
                            >
                              {booking.payment_status || 'Unknown'}
                            </span>
                          </div>
                        </div>

                        {(booking.guest_email || booking.guest_phone) && (
                          <div className="mt-3 space-y-1 text-xs text-slate-500">
                            {booking.guest_email ? <div>{booking.guest_email}</div> : null}
                            {booking.guest_phone ? <div>{booking.guest_phone}</div> : null}
                          </div>
                        )}

                        <div className="mt-3 text-xs text-slate-500">
                          Balance:{' '}
                          <span className="font-medium text-slate-700">
                            {formatMoney(booking.balance_due)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-12">
          <div className="xl:col-span-8" style={{ ...cardStyle, padding: '24px' }}>
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">
                  In-House Guests
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Current stays spanning today.
                </p>
              </div>
              <Link
                href="/desk/rooms"
                className="text-sm font-medium text-slate-700 hover:text-slate-900"
              >
                Room view
              </Link>
            </div>

            <div
              className="mt-5 overflow-x-auto"
              style={{
                border: '1px solid #e2e8f0',
                borderRadius: '16px',
                background: '#ffffff',
              }}
            >
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead style={{ background: '#f8fafc' }}>
                  <tr>
                    <th className="px-4 py-3 text-left font-medium text-slate-600">
                      Guest
                    </th>
                    <th className="px-4 py-3 text-left font-medium text-slate-600">
                      Room
                    </th>
                    <th className="px-4 py-3 text-left font-medium text-slate-600">
                      Stay
                    </th>
                    <th className="px-4 py-3 text-left font-medium text-slate-600">
                      Payment
                    </th>
                    <th className="px-4 py-3 text-left font-medium text-slate-600">
                      Contact
                    </th>
                    <th className="px-4 py-3 text-left font-medium text-slate-600">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white">
                  {typedInHouse.length === 0 ? (
                    <tr>
                      <td
                        colSpan={6}
                        className="px-4 py-10 text-center text-sm text-slate-500"
                      >
                        No in-house guests right now.
                      </td>
                    </tr>
                  ) : (
                    typedInHouse.slice(0, 12).map((booking) => (
                      <tr key={booking.id}>
                        <td className="px-4 py-4 align-top">
                          <div className="font-semibold text-slate-900">
                            {getGuestName(booking)}
                          </div>
                          <div className="mt-1 text-xs text-slate-500">
                            {formatNights(booking.nights)}
                          </div>
                        </td>
                        <td className="px-4 py-4 align-top text-slate-700">
                          {getUnitLabel(booking, inventoryMap)}
                        </td>
                        <td className="px-4 py-4 align-top text-slate-700">
                          {formatDateLabel(booking.check_in_date)} –{' '}
                          {formatDateLabel(booking.check_out_date)}
                        </td>
                        <td className="px-4 py-4 align-top">
                          <div
                            style={{
                              ...paymentBadgeStyle(booking.payment_status),
                              display: 'inline-flex',
                              borderRadius: '999px',
                              padding: '4px 10px',
                              fontSize: '12px',
                              fontWeight: 600,
                            }}
                          >
                            {booking.payment_status || 'Unknown'}
                          </div>
                          <div className="mt-2 text-xs text-slate-500">
                            Balance: {formatMoney(booking.balance_due)}
                          </div>
                        </td>
                        <td className="px-4 py-4 align-top text-slate-700">
                          <div>{booking.guest_email || '—'}</div>
                          <div className="mt-1 text-xs text-slate-500">
                            {booking.guest_phone || ''}
                          </div>
                        </td>
                        <td className="px-4 py-4 align-top">
                          <form action={checkOutBooking.bind(null, booking.id)}>
                            <button
                              type="submit"
                              style={{
                                borderRadius: '12px',
                                background: '#2563eb',
                                color: '#ffffff',
                                padding: '10px 16px',
                                fontSize: '12px',
                                fontWeight: 600,
                                border: 'none',
                                cursor: 'pointer',
                              }}
                            >
                              Check Out
                            </button>
                          </form>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="xl:col-span-4" style={{ ...cardStyle, padding: '24px' }}>
            <h2 className="text-lg font-semibold text-slate-900">Quick Actions</h2>
            <p className="mt-1 text-sm text-slate-500">
              Common front desk tasks.
            </p>

            <div className="mt-5 grid gap-3">
              <Link href="/desk/bookings" style={{ ...softCardStyle, padding: '14px 16px', textDecoration: 'none', color: '#1e293b', fontWeight: 500 }}>
                Open bookings
              </Link>
              <Link href="/desk/rooms" style={{ ...softCardStyle, padding: '14px 16px', textDecoration: 'none', color: '#1e293b', fontWeight: 500 }}>
                Open rooms
              </Link>
              <Link href="/desk/housekeeping" style={{ ...softCardStyle, padding: '14px 16px', textDecoration: 'none', color: '#1e293b', fontWeight: 500 }}>
                Housekeeping
              </Link>
              <Link href="/admin/calendar" style={{ ...softCardStyle, padding: '14px 16px', textDecoration: 'none', color: '#1e293b', fontWeight: 500 }}>
                Calendar
              </Link>
              <Link href="/admin/reports" style={{ ...softCardStyle, padding: '14px 16px', textDecoration: 'none', color: '#1e293b', fontWeight: 500 }}>
                Reports
              </Link>
            
            </div>

            <div className="mt-6" style={{ ...softCardStyle, padding: '16px' }}>
              <p className="text-sm font-semibold text-slate-900">At a glance</p>
              <div className="mt-3 space-y-2 text-sm text-slate-600">
                <div className="flex items-center justify-between">
                  <span>Vacant rooms</span>
                  <span className="font-semibold text-slate-900">{vacantCount}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Occupied rooms</span>
                  <span className="font-semibold text-slate-900">{occupiedCount}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Today’s arrivals</span>
                  <span className="font-semibold text-slate-900">{typedArrivals.length}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Today’s departures</span>
                  <span className="font-semibold text-slate-900">{typedDepartures.length}</span>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}