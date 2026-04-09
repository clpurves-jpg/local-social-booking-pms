import Link from 'next/link';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import type { CSSProperties } from 'react';
import { getSupabaseAdmin } from '@/lib/supabase';

type SearchParams = {
  roomId?: string;
  checkIn?: string;
  checkOut?: string;
  source?: string;
  error?: string;
};

type RoomRow = {
  id: string;
  name: string | null;
  room_number: string | null;
  room_type: string | null;
  nightly_rate: number | string | null;
  flat_rate_display: number | string | null;
  base_rate: number | string | null;
  max_guests: number | null;
  sort_order: number | null;
};

function cardStyle(): CSSProperties {
  return {
    background: '#ffffff',
    borderRadius: '24px',
    padding: '24px',
    boxShadow: '0 8px 24px rgba(15, 23, 42, 0.08)',
  };
}

function inputStyle(): CSSProperties {
  return {
    width: '100%',
    padding: '12px 14px',
    borderRadius: '14px',
    border: '1px solid #cbd5e1',
    fontSize: '14px',
    color: '#0f172a',
    background: '#ffffff',
    outline: 'none',
    boxSizing: 'border-box',
  };
}

function labelStyle(): CSSProperties {
  return {
    display: 'block',
    marginBottom: '8px',
    fontSize: '13px',
    fontWeight: 700,
    color: '#334155',
  };
}

function textAreaStyle(): CSSProperties {
  return {
    ...inputStyle(),
    minHeight: '110px',
    resize: 'vertical',
  };
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function toIsoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function formatCurrency(value?: number | string | null) {
  const amount = Number(value ?? 0);

  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2,
  }).format(amount);
}

function parseNumber(value: FormDataEntryValue | null, fallback = 0) {
  const parsed = Number(value ?? fallback);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function cleanText(value: FormDataEntryValue | null) {
  return String(value ?? '').trim();
}

function buildGuestName(
  first?: string | null,
  last?: string | null,
  email?: string | null,
) {
  const full = [first, last].filter(Boolean).join(' ').trim();
  return full || email || 'Guest';
}

function makeConfirmationCode() {
  const random = crypto.randomUUID().replace(/-/g, '').slice(0, 8).toUpperCase();
  return `REL-${random}`;
}

function asNumber(value: unknown) {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function getRoomRate(room?: RoomRow | null) {
  if (!room) return 0;

  return (
    asNumber(room.nightly_rate) ||
    asNumber(room.flat_rate_display) ||
    asNumber(room.base_rate) ||
    0
  );
}

async function createFrontDeskBooking(formData: FormData) {
  'use server';

  const supabase = getSupabaseAdmin();

  const inventoryId = cleanText(formData.get('inventory_id'));
  const guestFirstName = cleanText(formData.get('guest_first_name'));
  const guestLastName = cleanText(formData.get('guest_last_name'));
  const guestEmail = cleanText(formData.get('guest_email'));
  const guestPhone = cleanText(formData.get('guest_phone'));

  const checkInDate = cleanText(formData.get('check_in_date'));
  const checkOutDate = cleanText(formData.get('check_out_date'));

  const status = cleanText(formData.get('status')) || 'confirmed';
  const source = cleanText(formData.get('source')) || 'admin';

  const displayedFlatRate = parseNumber(formData.get('displayed_flat_rate'), 0);
  const grossAmount = parseNumber(formData.get('gross_amount'), 0);

  const internalNotes = cleanText(formData.get('internal_notes'));
  const specialRequests = cleanText(formData.get('special_requests'));

  const adults = parseNumber(formData.get('adults'), 1);
  const children = parseNumber(formData.get('children'), 0);

  const baseRedirectParams = new URLSearchParams();
  if (inventoryId) baseRedirectParams.set('roomId', inventoryId);
  if (checkInDate) baseRedirectParams.set('checkIn', checkInDate);
  if (checkOutDate) baseRedirectParams.set('checkOut', checkOutDate);
  if (source) baseRedirectParams.set('source', source);

  const fail = (message: string) => {
    const params = new URLSearchParams(baseRedirectParams);
    params.set('error', message);
    redirect(`/desk/bookings/new?${params.toString()}`);
  };

  if (!inventoryId) {
    fail('Please select a room.');
  }

  if (!guestFirstName && !guestLastName && !guestEmail) {
    fail('Please enter at least a guest name or email.');
  }

  if (!checkInDate || !checkOutDate) {
    fail('Please enter check-in and check-out dates.');
  }

  if (checkInDate >= checkOutDate) {
    fail('Check-out date must be after check-in date.');
  }

  const allowedStatuses = new Set(['hold', 'confirmed', 'checked_in']);
  const allowedSources = new Set(['website', 'phone', 'walk_in', 'admin']);

  if (!allowedStatuses.has(status)) {
    fail('Invalid booking status.');
  }

  if (!allowedSources.has(source)) {
    fail('Invalid booking source.');
  }

  const checkIn = new Date(`${checkInDate}T00:00:00`);
  const checkOut = new Date(`${checkOutDate}T00:00:00`);
  const nights = Math.round(
    (checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24),
  );

  if (nights < 1) {
    fail('Reservation must be at least 1 night.');
  }

  const { data: conflictingBookings, error: conflictingBookingsError } = await supabase
    .from('bookings')
    .select(
      'id, confirmation_code, guest_first_name, guest_last_name, guest_email, check_in_date, check_out_date, status',
    )
    .eq('inventory_id', inventoryId)
    .not('status', 'in', '("cancelled","checked_out","no_show","refunded")')
    .lt('check_in_date', checkOutDate)
    .gt('check_out_date', checkInDate)
    .limit(1);

  if (conflictingBookingsError) {
    fail(`Could not validate room availability: ${conflictingBookingsError.message}`);
  }

  const existingConflict = conflictingBookings?.[0];

  if (existingConflict) {
    const conflictName = buildGuestName(
      existingConflict.guest_first_name,
      existingConflict.guest_last_name,
      existingConflict.guest_email,
    );

    fail(
      `Room conflict: ${conflictName} already overlaps those dates${
        existingConflict.confirmation_code
          ? ` (${existingConflict.confirmation_code})`
          : ''
      }.`,
    );
  }

  const { data: conflictingBlocks, error: conflictingBlocksError } = await supabase
    .from('inventory_blocks')
    .select('id, reason, start_date, end_date')
    .eq('inventory_id', inventoryId)
    .lt('start_date', checkOutDate)
    .gt('end_date', checkInDate)
    .limit(1);

  if (conflictingBlocksError) {
    fail(`Could not validate inventory blocks: ${conflictingBlocksError.message}`);
  }

  const existingBlock = conflictingBlocks?.[0];

  if (existingBlock) {
    fail(
      `Room is blocked for those dates${
        existingBlock.reason ? ` (${existingBlock.reason})` : ''
      }.`,
    );
  }

  const confirmationCode = makeConfirmationCode();

  const combinedNotes = [
    internalNotes,
    specialRequests ? `Special Requests: ${specialRequests}` : '',
    `Occupancy entered by front desk: ${adults} adult${
      adults === 1 ? '' : 's'
    }, ${children} child${children === 1 ? '' : 'ren'}.`,
  ]
    .filter(Boolean)
    .join('\n\n');

  const insertPayload = {
    confirmation_code: confirmationCode,
    guest_first_name: guestFirstName || null,
    guest_last_name: guestLastName || null,
    guest_email: guestEmail || null,
    guest_phone: guestPhone || null,
    inventory_id: inventoryId,
    check_in_date: checkInDate,
    check_out_date: checkOutDate,
    nights,
    status,
    source,
    hold_expires_at:
      status === 'hold'
        ? new Date(Date.now() + 30 * 60 * 1000).toISOString()
        : null,
    displayed_flat_rate: displayedFlatRate,
    gross_amount: grossAmount,
    internal_notes: combinedNotes || null,
  };

  const { data: insertedRows, error: insertError } = await supabase
    .from('bookings')
    .insert(insertPayload)
    .select('id');

  if (insertError) {
    fail(`Could not create booking: ${insertError.message}`);
  }

  const insertedBookingId = insertedRows?.[0]?.id;

  if (!insertedBookingId) {
    fail('Booking was created, but no booking ID was returned.');
  }

  revalidatePath('/desk');
  revalidatePath('/desk/bookings/new');
  revalidatePath(`/desk/bookings/${insertedBookingId}`);

  redirect(`/desk/bookings/${insertedBookingId}?message=Booking created.`);
}

export default async function NewDeskBookingPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>;
}) {
  const params = (await searchParams) ?? {};
  const supabase = getSupabaseAdmin();

  const today = new Date();
  const defaultCheckIn = params.checkIn || toIsoDate(today);
  const defaultCheckOut = params.checkOut || toIsoDate(addDays(today, 1));
  const defaultSource =
    params.source && ['website', 'phone', 'walk_in', 'admin'].includes(params.source)
      ? params.source
      : 'admin';

  const { data: rooms, error: roomsError } = await supabase
    .from('inventory_units')
    .select(
      'id, name, room_number, room_type, nightly_rate, flat_rate_display, base_rate, max_guests, sort_order',
    )
    .eq('active', true)
    .eq('inventory_type_code', 'room')
    .order('sort_order', { ascending: true })
    .order('room_number', { ascending: true });

  if (roomsError) {
    throw new Error(`Failed to load rooms: ${roomsError.message}`);
  }

  const allRooms = (rooms ?? []) as RoomRow[];

  const selectedRoom =
    allRooms.find((room) => String(room.id) === String(params.roomId)) ??
    allRooms[0] ??
    null;

  const selectedRoomRate = getRoomRate(selectedRoom);

  return (
    <div style={{ display: 'grid', gap: '24px' }}>
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '16px',
        }}
      >
        <div>
          <h1
            style={{
              margin: 0,
              fontSize: '34px',
              color: '#0F3B5F',
            }}
          >
            Create Front Desk Booking
          </h1>
          <p
            style={{
              margin: '10px 0 0 0',
              color: '#64748b',
              fontSize: '15px',
            }}
          >
            Use this form for walk-ins, phone reservations, or staff-created bookings.
          </p>
        </div>

        <Link
          href="/desk"
          style={{
            padding: '10px 16px',
            borderRadius: '999px',
            border: '1px solid #cbd5e1',
            textDecoration: 'none',
            color: '#334155',
            background: '#ffffff',
            fontWeight: 700,
          }}
        >
          Back to Front Desk
        </Link>
      </div>

      {params.error ? (
        <div
          style={{
            ...cardStyle(),
            border: '1px solid #fecaca',
            background: '#fef2f2',
            color: '#991b1b',
            padding: '16px 20px',
          }}
        >
          {params.error}
        </div>
      ) : null}

      <div
        style={{
          display: 'grid',
          gap: '24px',
          gridTemplateColumns: 'minmax(0, 1.5fr) minmax(320px, 0.9fr)',
          alignItems: 'start',
        }}
      >
        <section style={cardStyle()}>
          <form action={createFrontDeskBooking} style={{ display: 'grid', gap: '24px' }}>
            <div>
              <h2
                style={{
                  margin: 0,
                  fontSize: '24px',
                  color: '#0f172a',
                }}
              >
                Reservation Details
              </h2>
              <p
                style={{
                  margin: '8px 0 0 0',
                  color: '#64748b',
                  fontSize: '14px',
                }}
              >
                Dates are validated against existing bookings and inventory blocks before save.
              </p>
            </div>

            <div
              style={{
                display: 'grid',
                gap: '18px',
                gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
              }}
            >
              <div style={{ gridColumn: '1 / -1' }}>
                <label htmlFor="inventory_id" style={labelStyle()}>
                  Room
                </label>
                <select
                  id="inventory_id"
                  name="inventory_id"
                  defaultValue={selectedRoom?.id ?? ''}
                  style={inputStyle()}
                  required
                >
                  <option value="" disabled>
                    Select a room
                  </option>
                  {allRooms.map((room) => (
                    <option key={room.id} value={room.id}>
                      {room.name ?? 'Room'} · Room {room.room_number ?? '—'} ·{' '}
                      {room.room_type ?? 'Room'} · {formatCurrency(getRoomRate(room))}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="check_in_date" style={labelStyle()}>
                  Check-In Date
                </label>
                <input
                  id="check_in_date"
                  name="check_in_date"
                  type="date"
                  defaultValue={defaultCheckIn}
                  style={inputStyle()}
                  required
                />
              </div>

              <div>
                <label htmlFor="check_out_date" style={labelStyle()}>
                  Check-Out Date
                </label>
                <input
                  id="check_out_date"
                  name="check_out_date"
                  type="date"
                  defaultValue={defaultCheckOut}
                  style={inputStyle()}
                  required
                />
              </div>

              <div>
                <label htmlFor="status" style={labelStyle()}>
                  Booking Status
                </label>
                <select id="status" name="status" defaultValue="confirmed" style={inputStyle()}>
                  <option value="hold">Hold</option>
                  <option value="confirmed">Confirmed</option>
                  <option value="checked_in">Checked In</option>
                </select>
              </div>

              <div>
                <label htmlFor="source" style={labelStyle()}>
                  Booking Source
                </label>
                <select
                  id="source"
                  name="source"
                  defaultValue={defaultSource}
                  style={inputStyle()}
                >
                  <option value="admin">Admin</option>
                  <option value="phone">Phone</option>
                  <option value="walk_in">Walk-In</option>
                  <option value="website">Website</option>
                </select>
              </div>
            </div>

            <div>
              <h3
                style={{
                  margin: 0,
                  fontSize: '20px',
                  color: '#0f172a',
                }}
              >
                Guest Information
              </h3>
            </div>

            <div
              style={{
                display: 'grid',
                gap: '18px',
                gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
              }}
            >
              <div>
                <label htmlFor="guest_first_name" style={labelStyle()}>
                  First Name
                </label>
                <input
                  id="guest_first_name"
                  name="guest_first_name"
                  type="text"
                  style={inputStyle()}
                  placeholder="Guest first name"
                />
              </div>

              <div>
                <label htmlFor="guest_last_name" style={labelStyle()}>
                  Last Name
                </label>
                <input
                  id="guest_last_name"
                  name="guest_last_name"
                  type="text"
                  style={inputStyle()}
                  placeholder="Guest last name"
                />
              </div>

              <div>
                <label htmlFor="guest_email" style={labelStyle()}>
                  Email
                </label>
                <input
                  id="guest_email"
                  name="guest_email"
                  type="email"
                  style={inputStyle()}
                  placeholder="guest@email.com"
                />
              </div>

              <div>
                <label htmlFor="guest_phone" style={labelStyle()}>
                  Phone
                </label>
                <input
                  id="guest_phone"
                  name="guest_phone"
                  type="tel"
                  style={inputStyle()}
                  placeholder="(555) 555-5555"
                />
              </div>

              <div>
                <label htmlFor="adults" style={labelStyle()}>
                  Adults
                </label>
                <input
                  id="adults"
                  name="adults"
                  type="number"
                  min={1}
                  defaultValue={1}
                  style={inputStyle()}
                />
              </div>

              <div>
                <label htmlFor="children" style={labelStyle()}>
                  Children
                </label>
                <input
                  id="children"
                  name="children"
                  type="number"
                  min={0}
                  defaultValue={0}
                  style={inputStyle()}
                />
              </div>
            </div>

            <div>
              <h3
                style={{
                  margin: 0,
                  fontSize: '20px',
                  color: '#0f172a',
                }}
              >
                Pricing & Notes
              </h3>
            </div>

            <div
              style={{
                display: 'grid',
                gap: '18px',
                gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
              }}
            >
              <div>
                <label htmlFor="displayed_flat_rate" style={labelStyle()}>
                  Nightly / Displayed Rate
                </label>
                <input
                  id="displayed_flat_rate"
                  name="displayed_flat_rate"
                  type="number"
                  min={0}
                  step="0.01"
                  defaultValue={selectedRoomRate}
                  style={inputStyle()}
                />
              </div>

              <div>
                <label htmlFor="gross_amount" style={labelStyle()}>
                  Total Amount
                </label>
                <input
                  id="gross_amount"
                  name="gross_amount"
                  type="number"
                  min={0}
                  step="0.01"
                  defaultValue={selectedRoomRate}
                  style={inputStyle()}
                />
              </div>

              <div style={{ gridColumn: '1 / -1' }}>
                <label htmlFor="special_requests" style={labelStyle()}>
                  Special Requests
                </label>
                <textarea
                  id="special_requests"
                  name="special_requests"
                  style={textAreaStyle()}
                  placeholder="Late arrival, pet notes, accessibility needs, extra towels, etc."
                />
              </div>

              <div style={{ gridColumn: '1 / -1' }}>
                <label htmlFor="internal_notes" style={labelStyle()}>
                  Internal Notes
                </label>
                <textarea
                  id="internal_notes"
                  name="internal_notes"
                  style={textAreaStyle()}
                  placeholder="Internal staff notes only."
                />
              </div>
            </div>

            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: '12px',
                paddingTop: '8px',
              }}
            >
              <button
                type="submit"
                style={{
                  padding: '12px 18px',
                  borderRadius: '999px',
                  border: '1px solid #0F3B5F',
                  background: '#0F3B5F',
                  color: '#ffffff',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Save Booking
              </button>

              <Link
                href="/desk"
                style={{
                  padding: '12px 18px',
                  borderRadius: '999px',
                  border: '1px solid #cbd5e1',
                  background: '#ffffff',
                  color: '#334155',
                  fontWeight: 700,
                  textDecoration: 'none',
                }}
              >
                Cancel
              </Link>
            </div>
          </form>
        </section>

        <aside style={{ display: 'grid', gap: '24px' }}>
          <section style={cardStyle()}>
            <h3
              style={{
                marginTop: 0,
                marginBottom: '14px',
                fontSize: '20px',
                color: '#0F3B5F',
              }}
            >
              Selected Room
            </h3>

            {selectedRoom ? (
              <div style={{ display: 'grid', gap: '10px', color: '#475569', fontSize: '14px' }}>
                <div style={{ fontWeight: 700, color: '#0f172a', fontSize: '18px' }}>
                  {selectedRoom.name ?? 'Room'}
                </div>
                <div>Room Number: {selectedRoom.room_number ?? '—'}</div>
                <div>Type: {selectedRoom.room_type ?? 'Room'}</div>
                <div>Display Rate: {formatCurrency(selectedRoomRate)}</div>
                <div>Max Guests: {selectedRoom.max_guests ?? '—'}</div>
              </div>
            ) : (
              <p style={{ margin: 0, color: '#64748b' }}>No active rooms found.</p>
            )}
          </section>

          <section style={cardStyle()}>
            <h3
              style={{
                marginTop: 0,
                marginBottom: '14px',
                fontSize: '20px',
                color: '#0F3B5F',
              }}
            >
              Workflow Notes
            </h3>

            <div style={{ display: 'grid', gap: '10px', color: '#64748b', fontSize: '14px' }}>
              <div>
                Use <strong>Hold</strong> when the room is temporarily reserved but not finalized.
              </div>
              <div>
                Use <strong>Confirmed</strong> for a normal saved reservation.
              </div>
              <div>
                Use <strong>Checked In</strong> only when the guest is already on property.
              </div>
              <div>
                This form blocks double-bookings by checking both bookings and inventory blocks.
              </div>
              <div>
                After save, it redirects to the booking detail page.
              </div>
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}