'use client';

import { useMemo, useState } from 'react';
import { money } from '@/lib/utils';

type GuestForm = {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
};

type InventoryUnit = {
  id: string;
  name: string;
  slug?: string | null;
  inventory_type_code?: string | null;
  room_number?: string | null;
  room_type?: string | null;
  description?: string | null;
  max_guests?: number | null;
  bed_summary?: string | null;
  flat_rate_display?: number | string | null;
  base_rate?: number | string | null;
  nightly_rate?: number | string | null;
  active?: boolean | null;
  sort_order?: number | null;
  cover_image_url?: string | null;
  image_url?: string | null;
};

type BookingCategory = 'rooms' | 'rv';

const ROOM_TYPES = ['room'];
const RV_TYPES = ['rv', 'rv_spot'];
const BOOKABLE_TYPES = [...ROOM_TYPES, ...RV_TYPES];
const PET_FEE_PER_PET = 10;

function getUnitLabel(unit: InventoryUnit) {
  if (ROOM_TYPES.includes(unit.inventory_type_code || '')) return 'Room';
  if (RV_TYPES.includes(unit.inventory_type_code || '')) return 'RV Spot';
  return 'Stay';
}

function getUnitMeta(unit: InventoryUnit) {
  if (ROOM_TYPES.includes(unit.inventory_type_code || '')) {
    return unit.room_type || 'Guest room';
  }

  if (RV_TYPES.includes(unit.inventory_type_code || '')) {
    return unit.bed_summary || unit.room_type || 'RV spot';
  }

  return 'Stay';
}

function getUnitImage(unit: InventoryUnit) {
  return unit.image_url || unit.cover_image_url || '';
}

function asNumber(value: number | string | null | undefined) {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function getUnitRate(unit: InventoryUnit) {
  return (
    asNumber(unit.nightly_rate) ||
    asNumber(unit.flat_rate_display) ||
    asNumber(unit.base_rate) ||
    0
  );
}

function diffNights(checkIn: string, checkOut: string) {
  const start = new Date(`${checkIn}T12:00:00`);
  const end = new Date(`${checkOut}T12:00:00`);
  return Math.max(0, Math.round((end.getTime() - start.getTime()) / 86400000));
}

export function BookingForm({ rooms }: { rooms: InventoryUnit[] }) {
  const today = new Date().toISOString().slice(0, 10);
  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);

  const initialUnits = useMemo(
    () =>
      (rooms ?? []).filter((item) =>
        BOOKABLE_TYPES.includes(item.inventory_type_code || '')
      ),
    [rooms]
  );

  const [activeCategory, setActiveCategory] = useState<BookingCategory>('rooms');
  const [checkIn, setCheckIn] = useState(today);
  const [checkOut, setCheckOut] = useState(tomorrow);
  const [guests, setGuests] = useState(2);
  const [petCount, setPetCount] = useState(0);
  const [available, setAvailable] = useState<InventoryUnit[]>(initialUnits);
  const [selectedRoomId, setSelectedRoomId] = useState<string>('');
  const [form, setForm] = useState<GuestForm>({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
  });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [acceptedPolicies, setAcceptedPolicies] = useState(false);

  const availableRooms = useMemo(
    () =>
      available.filter((item) =>
        ROOM_TYPES.includes(item.inventory_type_code || '')
      ),
    [available]
  );

  const availableRvSpots = useMemo(
    () =>
      available.filter((item) => RV_TYPES.includes(item.inventory_type_code || '')),
    [available]
  );

  const visibleUnits = useMemo(
    () => (activeCategory === 'rooms' ? availableRooms : availableRvSpots),
    [activeCategory, availableRooms, availableRvSpots]
  );

  const selectedRoom = useMemo(
    () => available.find((r) => r.id === selectedRoomId),
    [available, selectedRoomId]
  );

  const nights = useMemo(() => diffNights(checkIn, checkOut), [checkIn, checkOut]);

  const nightlyRate = useMemo(
    () => (selectedRoom ? getUnitRate(selectedRoom) : 0),
    [selectedRoom]
  );

  const lodgingSubtotal = useMemo(
    () => nights * nightlyRate,
    [nights, nightlyRate]
  );

  const petFee = useMemo(() => petCount * PET_FEE_PER_PET, [petCount]);

  const total = useMemo(() => lodgingSubtotal + petFee, [lodgingSubtotal, petFee]);

  function switchCategory(category: BookingCategory) {
    setActiveCategory(category);
    setSelectedRoomId('');
    setMessage('');
  }

  async function searchAvailability() {
    try {
      setBusy(true);
      setMessage('');

      const res = await fetch('/api/availability/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          check_in: checkIn,
          check_out: checkOut,
          guests,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setAvailable([]);
        setSelectedRoomId('');
        setMessage(data.details || data.error || 'Could not check availability.');
        return;
      }

      const filtered = (data.rooms || []).filter((item: InventoryUnit) =>
        BOOKABLE_TYPES.includes(item.inventory_type_code || '')
      );

      setAvailable(filtered);
      setSelectedRoomId('');
    } catch (error) {
      console.error('Availability search failed:', error);
      setAvailable([]);
      setSelectedRoomId('');
      setMessage('Could not check availability.');
    } finally {
      setBusy(false);
    }
  }

  async function reserveNow() {
    if (!acceptedPolicies) {
  setMessage('You must agree to the terms and pet policy before booking.');
  return;
}
    if (!selectedRoomId) {
      setMessage(
        activeCategory === 'rooms'
          ? 'Please choose a room first.'
          : 'Please choose an RV spot first.'
      );
      return;
    }

    if (!selectedRoom) {
      setMessage('Selected unit not found.');
      return;
    }

    if (!form.first_name.trim() || !form.last_name.trim() || !form.email.trim()) {
      setMessage('Please complete guest details.');
      return;
    }

    const trimmedEmail = form.email.trim();
    const trimmedPhone = form.phone.trim();
    const guestName = `${form.first_name.trim()} ${form.last_name.trim()}`.trim();

    if (!trimmedEmail.includes('@')) {
      setMessage('Please enter a valid email address.');
      return;
    }

    try {
      setBusy(true);
      setMessage('Creating secure hold...');

      const holdRes = await fetch('/api/booking/hold', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          room_id: selectedRoomId,
          check_in: checkIn,
          check_out: checkOut,
          guest_email: trimmedEmail,
          guest_name: guestName,
          guest_phone: trimmedPhone || null,
          pet_count: petCount,
        }),
      });

      const holdData = await holdRes.json();

      if (!holdRes.ok) {
        setMessage(holdData.details || holdData.error || 'Could not create hold.');
        return;
      }

      const bookingId =
        holdData?.booking?.id || holdData?.hold?.id || holdData?.id;

      if (!bookingId) {
        setMessage('Hold created but checkout ID is missing.');
        return;
      }

      setMessage('Redirecting to secure checkout...');

      const checkoutRes = await fetch('/api/checkout/create-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ booking_id: bookingId }),
      });

      const checkoutData = await checkoutRes.json();

      if (!checkoutRes.ok) {
        setMessage(
          checkoutData.details || checkoutData.error || 'Could not start checkout.'
        );
        return;
      }

      if (!checkoutData.url) {
        setMessage('Checkout URL missing.');
        return;
      }

      window.location.href = checkoutData.url;
    } catch (error) {
      console.error('Reserve and pay failed:', error);
      setMessage('Something went wrong starting checkout.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid">
      <div
        className="inline"
        style={{
          gap: 12,
          marginBottom: 8,
          flexWrap: 'wrap',
        }}
      >
        <button
          type="button"
          className="btn"
          onClick={() => switchCategory('rooms')}
          style={{
            opacity: activeCategory === 'rooms' ? 1 : 0.75,
            background: activeCategory === 'rooms' ? undefined : '#64748b',
          }}
        >
          Rooms
        </button>

        <button
          type="button"
          className="btn"
          onClick={() => switchCategory('rv')}
          style={{
            opacity: activeCategory === 'rv' ? 1 : 0.75,
            background: activeCategory === 'rv' ? undefined : '#64748b',
          }}
        >
          RV Spots
        </button>
      </div>

      <div className="grid grid-4">
        <div>
          <label className="label">Check in</label>
          <input
            className="input"
            type="date"
            value={checkIn}
            onChange={(e) => setCheckIn(e.target.value)}
          />
        </div>

        <div>
          <label className="label">Check out</label>
          <input
            className="input"
            type="date"
            value={checkOut}
            onChange={(e) => setCheckOut(e.target.value)}
          />
        </div>

        <div>
          <label className="label">Guests</label>
          <input
            className="input"
            type="number"
            min={1}
            max={12}
            value={guests}
            onChange={(e) => setGuests(Number(e.target.value))}
          />
        </div>

        <div style={{ alignSelf: 'end' }}>
          <button className="btn" onClick={searchAvailability} disabled={busy}>
            {busy ? 'Checking...' : 'Check availability'}
          </button>
        </div>
      </div>

      <div className="grid">
        <h3 className="heading-md" style={{ marginTop: 8 }}>
          {activeCategory === 'rooms' ? 'Available Rooms' : 'Available RV Spots'}
        </h3>

        {visibleUnits.map((unit) => {
          const unitRate = getUnitRate(unit);

          return (
            <label
              key={unit.id}
              className="card room-card"
              style={{
                cursor: 'pointer',
                border:
                  selectedRoomId === unit.id ? '2px solid var(--brand)' : undefined,
              }}
            >
              <div style={{ background: '#f0f2f7', minHeight: 200 }}>
                {getUnitImage(unit) ? (
                  <img src={getUnitImage(unit)} alt={unit.name} />
                ) : null}
              </div>

              <div className="card-pad">
                <div className="inline" style={{ justifyContent: 'space-between' }}>
                  <h3 className="heading-md">{unit.name}</h3>
                  <input
                    type="radio"
                    name="room"
                    checked={selectedRoomId === unit.id}
                    onChange={() => setSelectedRoomId(unit.id)}
                  />
                </div>

                <div className="text-muted">
                  {getUnitMeta(unit)}
                  {unit.max_guests ? ` · Up to ${unit.max_guests} guests` : ''}
                </div>

                <p>{unit.description || 'No description added yet.'}</p>

                <strong>
                  {unitRate > 0 ? `${money(unitRate)} / night` : 'Rate coming soon'}
                </strong>

                <div className="small text-muted" style={{ marginTop: 6 }}>
                  Taxes and fees included in rate shown to guest.
                </div>
              </div>
            </label>
          );
        })}

        {!visibleUnits.length ? (
          <div className="card card-pad">
            {activeCategory === 'rooms'
              ? 'No rooms available for those dates.'
              : 'No RV spots available for those dates.'}
          </div>
        ) : null}
      </div>

      <div className="card card-pad">
        <h3 className="heading-md">Guest details</h3>

        <div className="grid grid-2">
          <div>
            <label className="label">First name</label>
            <input
              className="input"
              value={form.first_name}
              onChange={(e) => setForm({ ...form, first_name: e.target.value })}
            />
          </div>

          <div>
            <label className="label">Last name</label>
            <input
              className="input"
              value={form.last_name}
              onChange={(e) => setForm({ ...form, last_name: e.target.value })}
            />
          </div>

          <div>
            <label className="label">Email</label>
            <input
              className="input"
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </div>

          <div>
            <label className="label">Phone</label>
            <input
              className="input"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
            />
          </div>
        </div>

        <div style={{ marginTop: 12 }}>
          <label className="label">Pets</label>
          <select
            className="input"
            value={petCount}
            onChange={(e) => setPetCount(Number(e.target.value))}
          >
            {[0, 1, 2, 3, 4].map((count) => (
              <option key={count} value={count}>
                {count}
              </option>
            ))}
          </select>
          <div className="small text-muted" style={{ marginTop: 6 }}>
            $10 per pet per stay.
          </div>
        </div>

        <div
          className="card"
          style={{
            marginTop: 16,
            padding: 16,
            background: '#f8fafc',
            border: '1px solid #e2e8f0',
          }}
        >
          <div className="inline" style={{ justifyContent: 'space-between' }}>
            <span className="text-muted">
              Lodging ({nights} {nights === 1 ? 'night' : 'nights'})
            </span>
            <strong>{money(lodgingSubtotal)}</strong>
          </div>

          <div
            className="inline"
            style={{ justifyContent: 'space-between', marginTop: 8 }}
          >
            <span className="text-muted">
              Pet fee ({petCount} {petCount === 1 ? 'pet' : 'pets'})
            </span>
            <strong>{money(petFee)}</strong>
          </div>

          <div
            className="inline"
            style={{
              justifyContent: 'space-between',
              marginTop: 12,
              paddingTop: 12,
              borderTop: '1px solid #cbd5e1',
            }}
          >
            <span>Total</span>
            <strong>{money(total)}</strong>
          </div>
        </div>

        <div className="section-gap">
  <div style={{ marginBottom: 10 }}>
    {selectedRoom ? (
      <>
        <strong>{selectedRoom.name}</strong>{' '}
        <span className="text-muted">
          {getUnitLabel(selectedRoom)} ·{' '}
          {getUnitRate(selectedRoom) > 0
            ? `${money(getUnitRate(selectedRoom))} / night`
            : 'Rate coming soon'}
        </span>
      </>
    ) : (
      <span className="text-muted">
        {activeCategory === 'rooms'
          ? 'Choose a room above.'
          : 'Choose an RV spot above.'}
      </span>
    )}
  </div>

  {/* ✅ NEW POLICY CHECKBOX */}
  <div className="card" style={{ padding: 12, marginBottom: 10 }}>
    <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
      <input
        type="checkbox"
        checked={acceptedPolicies}
        onChange={(e) => setAcceptedPolicies(e.target.checked)}
        style={{ marginTop: 4 }}
      />

      <span className="small">
        I agree to the{' '}
        <a href="/terms" target="_blank">Terms</a>,{' '}
        <a href="/privacy" target="_blank">Privacy Policy</a>, and{' '}
        <a href="/pet-policy" target="_blank">Pet Policy</a>.
        <br />
        <strong>
          Pets are $10 each. Guests are responsible for cleanup. Additional fees may apply for damages or excessive mess.
        </strong>
      </span>
    </label>
  </div>

  <button className="btn" onClick={reserveNow} disabled={busy}>
    {busy ? 'Working...' : 'Reserve and pay'}
  </button>
</div>

        {message ? (
          <div className="small" style={{ marginTop: 10 }}>
            {message}
          </div>
        ) : null}
      </div>
      </div>
  );
}