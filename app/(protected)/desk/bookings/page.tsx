import Link from 'next/link';
import {
  checkInBooking,
  overrideCheckInBooking,
  checkOutBooking,
  markBookingPaidCash,
  cancelBooking,
} from '../actions';
import { requireRole } from '@/lib/auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import BookingActionButton from '@/components/desk/BookingActionButton';
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
  internal_notes?: string | null;
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

function formatDateLabel(date: string | null): string {
  if (!date) return '—';
  const parsed = new Date(`${date}T12:00:00`);
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
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

function isPaidInFull(booking: BookingRow): boolean {
  if (booking.payment_status === 'paid') return true;
  return Number(booking.balance_due ?? 0) <= 0;
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
      return {
        background: '#eff6ff',
        color: '#1d4ed8',
        border: '1px solid #93c5fd',
      };
    case 'unpaid':
      return {
        background: '#fffbeb',
        color: '#b45309',
        border: '1px solid #fcd34d',
      };
    case 'pay_at_property':
      return {
        background: '#fff7ed',
        color: '#c2410c',
        border: '1px solid #fdba74',
      };
    case 'refunded':
      return {
        background: '#f8fafc',
        color: '#475569',
        border: '1px solid #cbd5e1',
      };
    default:
      return {
        background: '#fff1f2',
        color: '#be123c',
        border: '1px solid #fda4af',
      };
  }
}

function stayBadgeStyle(booking: BookingRow): React.CSSProperties {
  if (booking.checked_out_at) {
    return {
      background: '#f8fafc',
      color: '#475569',
      border: '1px solid #cbd5e1',
    };
  }

  if (booking.checked_in_at) {
    return {
      background: '#eff6ff',
      color: '#1d4ed8',
      border: '1px solid #93c5fd',
    };
  }

  return {
    background: '#ecfdf5',
    color: '#047857',
    border: '1px solid #a7f3d0',
  };
}

function stayLabel(booking: BookingRow): string {
  if (booking.checked_out_at) return 'Checked Out';
  if (booking.checked_in_at) return 'Checked In';
  return 'Reserved';
}

function normalizeParam(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? '' : value ?? '';
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

export default async function BookingsPage({
  searchParams,
}: {
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  await requireRole(['desk', 'admin']);

  const params = searchParams ? await searchParams : {};
  const q = normalizeParam(params.q).trim();
  const view = normalizeParam(params.view) || 'all';

  const supabase = getSupabaseAdmin();
  const today = getBoiseToday();

  let query = supabase
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
      internal_notes,
      created_at
    `
    )
    .neq('status', 'cancelled')
    .order('created_at', { ascending: false })
    .limit(100);

  if (view === 'arrivals') {
    query = query
      .eq('check_in_date', today)
      .is('checked_in_at', null)
      .is('checked_out_at', null);
  } else if (view === 'in_house') {
    query = query.not('checked_in_at', 'is', null).is('checked_out_at', null);
  } else if (view === 'departures') {
    query = query
      .eq('check_out_date', today)
      .not('checked_in_at', 'is', null)
      .is('checked_out_at', null);
  } else if (view === 'upcoming') {
    query = query
      .gt('check_in_date', today)
      .is('checked_in_at', null)
      .is('checked_out_at', null)
      .order('check_in_date', { ascending: true });
  }

  if (q) {
    const escaped = q.replaceAll(',', ' ').trim();
    query = query.or(
      [
        `guest_first_name.ilike.%${escaped}%`,
        `guest_last_name.ilike.%${escaped}%`,
        `guest_email.ilike.%${escaped}%`,
        `confirmation_code.ilike.%${escaped}%`,
      ].join(',')
    );
  }

  const [
    { data: bookings = [], error: bookingsError },
    { data: units = [], error: unitsError },
  ] = await Promise.all([
    query,
    supabase
      .from('inventory_units')
      .select('id, name, room_number, room_type, inventory_type_code, sort_order')
      .order('sort_order', { ascending: true })
      .order('name', { ascending: true }),
  ]);

  if (bookingsError) {
    throw new Error(`Failed to load bookings: ${bookingsError.message}`);
  }

  if (unitsError) {
    throw new Error(`Failed to load rooms: ${unitsError.message}`);
  }

  const typedBookings = bookings as BookingRow[];
  const typedUnits = units as InventoryUnitRow[];

  const inventoryMap = new Map<string, InventoryUnitRow>(
    typedUnits.map((unit) => [unit.id, unit])
  );

  const totalCount = typedBookings.length;
  const arrivalsCount = typedBookings.filter(
    (b) => b.check_in_date === today && !b.checked_in_at && !b.checked_out_at
  ).length;
  const inHouseCount = typedBookings.filter(
    (b) => !!b.checked_in_at && !b.checked_out_at
  ).length;
  const departuresCount = typedBookings.filter(
    (b) => b.check_out_date === today && !!b.checked_in_at && !b.checked_out_at
  ).length;

  const views = [
    { key: 'all', label: 'All', count: totalCount },
    { key: 'arrivals', label: 'Arrivals Today', count: arrivalsCount },
    { key: 'in_house', label: 'In House', count: inHouseCount },
    { key: 'departures', label: 'Departures Today', count: departuresCount },
    { key: 'upcoming', label: 'Upcoming', count: null },
  ];

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
                Desk Bookings
              </div>
              <h1 className="text-4xl font-semibold tracking-tight">Bookings</h1>
              <p
                className="mt-2 text-base"
                style={{ color: 'rgba(255,255,255,0.85)' }}
              >
                Search, filter, and manage guest stays from one place.
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
                <Link
  href="/desk/new"
  style={{
    ...actionLinkStyle,
    background: '#ffffff',
    color: '#0f172a',
  }}
>
  New Booking
</Link>
                Back to Dashboard
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
                href="/admin/calendar"
                style={{
                  ...actionLinkStyle,
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

        <section style={{ ...cardStyle, padding: '20px' }}>
          <form className="grid gap-4 lg:grid-cols-[1fr_auto]" method="get">
            <div className="grid gap-4 md:grid-cols-[1fr_auto]">
              <input
                type="text"
                name="q"
                defaultValue={q}
                placeholder="Search guest, email, or confirmation code"
                className="w-full"
                style={{
                  border: '1px solid #cbd5e1',
                  borderRadius: '14px',
                  padding: '12px 14px',
                  background: '#ffffff',
                  fontSize: '14px',
                }}
              />
              <input type="hidden" name="view" value={view} />
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
                Search
              </button>
            </div>

            <div className="flex flex-wrap gap-2">
              {views.map((item) => {
                const active = view === item.key;
                const href = `/desk/bookings?view=${encodeURIComponent(item.key)}${
                  q ? `&q=${encodeURIComponent(q)}` : ''
                }`;

                return (
                  <Link
                    key={item.key}
                    href={href}
                    style={{
                      ...pillStyle,
                      textDecoration: 'none',
                      background: active ? '#0f172a' : '#f1f5f9',
                      color: active ? '#ffffff' : '#334155',
                      border: active ? '1px solid #0f172a' : '1px solid #cbd5e1',
                      padding: '8px 12px',
                    }}
                  >
                    {item.label}
                    {item.count !== null ? ` • ${item.count}` : ''}
                  </Link>
                );
              })}
            </div>
          </form>
        </section>

        <section className="grid gap-4 md:grid-cols-4">
          <div style={{ ...cardStyle, padding: '18px' }}>
            <p className="text-sm text-slate-500">Showing</p>
            <p className="mt-2 text-3xl font-semibold text-slate-900">
              {typedBookings.length}
            </p>
          </div>
          <div style={{ ...cardStyle, padding: '18px' }}>
            <p className="text-sm text-slate-500">Arrivals Today</p>
            <p className="mt-2 text-3xl font-semibold text-slate-900">
              {arrivalsCount}
            </p>
          </div>
          <div style={{ ...cardStyle, padding: '18px' }}>
            <p className="text-sm text-slate-500">In House</p>
            <p className="mt-2 text-3xl font-semibold text-slate-900">
              {inHouseCount}
            </p>
          </div>
          <div style={{ ...cardStyle, padding: '18px' }}>
            <p className="text-sm text-slate-500">Departures Today</p>
            <p className="mt-2 text-3xl font-semibold text-slate-900">
              {departuresCount}
            </p>
          </div>
        </section>

        <section style={{ ...cardStyle, padding: '24px' }}>
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">
                Booking List
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Manage payments, arrivals, in-house stays, and departures.
              </p>
            </div>
          </div>

          {typedBookings.length === 0 ? (
            <EmptyState message="No bookings match this filter yet." />
          ) : (
            <div className="space-y-4">
              {typedBookings.map((booking) => {
                const paidInFull = isPaidInFull(booking);
                const canCheckIn = !booking.checked_in_at && !booking.checked_out_at;
                const canCheckOut = !!booking.checked_in_at && !booking.checked_out_at;
                const canMarkPaidCash =
                  booking.payment_status !== 'paid' && !booking.checked_out_at;
                const canCancel =
                  !booking.checked_in_at &&
                  !booking.checked_out_at &&
                  booking.status !== 'cancelled';

                const guestName = getGuestName(booking);
                const unitLabel = getUnitLabel(booking, inventoryMap);

                return (
                  <div
                    key={booking.id}
                    style={{ ...softCardStyle, padding: '18px' }}
                  >
                    <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <div
                                style={{
                                  width: '40px',
                                  height: '40px',
                                  borderRadius: '999px',
                                  background: '#0f172a',
                                  color: '#ffffff',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  fontSize: '13px',
                                  fontWeight: 700,
                                }}
                              >
                                {getGuestInitials(booking)}
                              </div>
                              <div>
                                <p className="font-semibold text-slate-900">
                                  {guestName}
                                </p>
                                <p className="text-sm text-slate-500">
                                  {unitLabel}
                                </p>
                              </div>
                            </div>

                            <div className="mt-3 flex flex-wrap gap-2">
                              <span style={{ ...pillStyle, ...stayBadgeStyle(booking) }}>
                                {stayLabel(booking)}
                              </span>
                              <span
                                style={{
                                  ...pillStyle,
                                  ...paymentBadgeStyle(
                                    paidInFull ? 'paid' : booking.payment_status
                                  ),
                                }}
                              >
                                {paidInFull ? 'paid' : booking.payment_status || 'Unknown'}
                              </span>
                              {!paidInFull && !booking.checked_out_at ? (
                                <span
                                  style={{
                                    ...pillStyle,
                                    background: '#fff7ed',
                                    color: '#c2410c',
                                    border: '1px solid #fdba74',
                                  }}
                                >
                                  Payment Required Before Check-In
                                </span>
                              ) : null}
                              {booking.confirmation_code ? (
                                <span
                                  style={{
                                    ...pillStyle,
                                    background: '#ffffff',
                                    color: '#334155',
                                    border: '1px solid #cbd5e1',
                                  }}
                                >
                                  #{booking.confirmation_code}
                                </span>
                              ) : null}
                            </div>
                          </div>

                          <div className="grid gap-2 text-sm text-slate-600 md:text-right">
                            <div>
                              <span className="font-medium text-slate-900">Stay:</span>{' '}
                              {formatDateLabel(booking.check_in_date)} –{' '}
                              {formatDateLabel(booking.check_out_date)}
                            </div>
                            <div>
                              <span className="font-medium text-slate-900">Length:</span>{' '}
                              {formatNights(booking.nights)}
                            </div>
                            <div>
                              <span className="font-medium text-slate-900">Balance:</span>{' '}
                              {formatMoney(booking.balance_due)}
                            </div>
                          </div>
                        </div>

                        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                          <div>
                            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                              Email
                            </p>
                            <p className="mt-1 text-sm text-slate-700">
                              {booking.guest_email || '—'}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                              Phone
                            </p>
                            <p className="mt-1 text-sm text-slate-700">
                              {booking.guest_phone || '—'}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                              Checked In
                            </p>
                            <p className="mt-1 text-sm text-slate-700">
                              {booking.checked_in_at
                                ? new Date(booking.checked_in_at).toLocaleString()
                                : '—'}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                              Checked Out
                            </p>
                            <p className="mt-1 text-sm text-slate-700">
                              {booking.checked_out_at
                                ? new Date(booking.checked_out_at).toLocaleString()
                                : '—'}
                            </p>
                          </div>
                        </div>

                        {booking.special_requests ? (
                          <div className="mt-4">
                            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                              Special Requests
                            </p>
                            <p className="mt-1 text-sm text-slate-700">
                              {booking.special_requests}
                            </p>
                          </div>
                        ) : null}
                      </div>

                      <div className="grid gap-2 xl:w-52">
                        {canCheckIn ? (
                          paidInFull ? (
                            <BookingActionButton
                              label="Check In"
                              confirmTitle="Confirm Check-In"
                              confirmMessage={`Check in ${guestName} to ${unitLabel}?`}
                              action={checkInBooking.bind(null, booking.id)}
                              tone="green"
                            />
                          ) : (
                            <BookingActionButton
                              label="Override Check-In"
                              confirmTitle="Override Payment Lock?"
                              confirmMessage={`${guestName} still has ${formatMoney(
                                booking.balance_due
                              )} due. Continue with override check-in for ${unitLabel}?`}
                              action={overrideCheckInBooking.bind(null, booking.id)}
                              tone="amber"
                            />
                          )
                          
                        ) : null}
                        <Link
  href={`/desk/bookings/${booking.id}`}
  style={{
    ...actionLinkStyle,
    width: '100%',
    background: '#ffffff',
    color: '#0f172a',
    border: '1px solid #cbd5e1',
  }}
>
  View Details
</Link>

                        {canCheckOut ? (
                          <BookingActionButton
                            label="Check Out"
                            confirmTitle="Confirm Check-Out"
                            confirmMessage={`Check out ${guestName} from ${unitLabel}?`}
                            action={checkOutBooking.bind(null, booking.id)}
                            tone="blue"
                          />
                        ) : null}

                        {canMarkPaidCash ? (
                          <BookingActionButton
                            label="Mark Paid Cash"
                            confirmTitle="Mark Paid Cash?"
                            confirmMessage={`Mark ${guestName} as paid and set balance due to ${formatMoney(
                              0
                            )}?`}
                            action={markBookingPaidCash.bind(null, booking.id)}
                            tone="amber"
                          />
                        ) : null}
                        <Link
                         href={`/desk/bookings/${booking.id}/receipt`}
                            style={{
                            ...actionLinkStyle,
                            width: '100%',
                            background: '#ffffff',
                            color: '#0f172a',
                            border: '1px solid #cbd5e1',
               }}
                 >
                        Print Receipt
                      </Link>
                        {canCancel ? (
                          <BookingActionButton
                            label="Cancel Booking"
                            confirmTitle="Cancel Booking?"
                            confirmMessage={`Cancel the reservation for ${guestName}? This should only be used for bookings that have not checked in.`}
                            action={cancelBooking.bind(null, booking.id)}
                            tone="red"
                          />
                        ) : null}

                        <Link
                          href="/desk"
                          style={{
                            ...actionLinkStyle,
                            width: '100%',
                            background: '#ffffff',
                            color: '#334155',
                            border: '1px solid #cbd5e1',
                          }}
                        >
                          Back
                        </Link>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}