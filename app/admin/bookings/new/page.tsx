'use client';

import { useMemo, useState } from 'react';

type Room = {
  id: string;
  name: string;
  room_type?: string | null;
  description?: string | null;
  max_guests?: number | null;
  cover_image_url?: string | null;
  image_url?: string | null;
  nightly_rate?: number | string | null;
  flat_rate_display?: number | string | null;
  base_rate?: number | string | null;
};

function money(value: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(value);
}

function asNumber(value: unknown) {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function getRoomRate(room?: Room | null) {
  if (!room) return 0;

  return (
    asNumber(room.nightly_rate) ||
    asNumber(room.flat_rate_display) ||
    asNumber(room.base_rate) ||
    0
  );
}

function getNightCount(checkIn: string, checkOut: string) {
  const start = new Date(checkIn);
  const end = new Date(checkOut);
  const diffMs = end.getTime() - start.getTime();
  const nights = Math.round(diffMs / (1000 * 60 * 60 * 24));
  return nights > 0 ? nights : 1;
}

function cardStyle(): React.CSSProperties {
  return {
    background: '#ffffff',
    borderRadius: '24px',
    padding: '24px',
    boxShadow: '0 8px 24px rgba(15, 23, 42, 0.08)',
  };
}

export default function AdminNewBookingPage() {
  const today = new Date().toISOString().slice(0, 10);
  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);

  const [checkIn, setCheckIn] = useState(today);
  const [checkOut, setCheckOut] = useState(tomorrow);
  const [guests, setGuests] = useState(2);

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');

  const [availableRooms, setAvailableRooms] = useState<Room[]>([]);
  const [selectedRoomId, setSelectedRoomId] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [paymentUrl, setPaymentUrl] = useState('');

  const selectedRoom = useMemo(
    () =>
      availableRooms.find((room) => String(room.id) === String(selectedRoomId)) ?? null,
    [availableRooms, selectedRoomId]
  );

  const nights = getNightCount(checkIn, checkOut);
  const roomRate = getRoomRate(selectedRoom);
  const estimatedTotal = nights * roomRate;

  async function searchAvailability() {
    try {
      setBusy(true);
      setMessage('');
      setPaymentUrl('');
      setSelectedRoomId('');

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
        setAvailableRooms([]);
        setMessage(data.details || data.error || 'Could not search availability.');
        return;
      }

      setAvailableRooms(data.rooms || []);
      setMessage((data.rooms || []).length ? 'Rooms loaded.' : 'No rooms available.');
    } catch (error) {
      console.error('Admin availability search failed:', error);
      setMessage('Could not search availability.');
    } finally {
      setBusy(false);
    }
  }

  function validateGuest() {
    if (!firstName.trim() || !lastName.trim()) {
      setMessage('Please enter the guest first and last name.');
      return false;
    }

    if (!email.trim() || !email.includes('@')) {
      setMessage('Please enter a valid guest email.');
      return false;
    }

    if (!selectedRoomId) {
      setMessage('Please choose a room.');
      return false;
    }

    return true;
  }

  async function createPaymentSession(openInNewTab: boolean) {
    if (!validateGuest()) return;

    try {
      setBusy(true);
      setMessage('Creating hold and secure payment session...');
      setPaymentUrl('');

      const holdRes = await fetch('/api/booking/hold', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          room_id: selectedRoomId,
          check_in: checkIn,
          check_out: checkOut,
          guest_email: email.trim(),
          guest_name: `${firstName.trim()} ${lastName.trim()}`.trim(),
          guest_phone: phone.trim() || null,
        }),
      });

      const holdData = await holdRes.json();

      if (!holdRes.ok) {
        setMessage(holdData.details || holdData.error || 'Could not create hold.');
        return;
      }

      const holdId = holdData?.booking?.id || holdData?.hold?.id || holdData?.id;

      if (!holdId) {
        setMessage('Hold created, but hold ID is missing.');
        return;
      }

      const checkoutRes = await fetch('/api/checkout/create-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ booking_id: holdId }),
      });

      const checkoutData = await checkoutRes.json();

      if (!checkoutRes.ok) {
        setMessage(
          checkoutData.details || checkoutData.error || 'Could not create Stripe checkout.'
        );
        return;
      }

      if (!checkoutData.url) {
        setMessage('Stripe checkout URL missing.');
        return;
      }

      setPaymentUrl(checkoutData.url);

      if (openInNewTab) {
        window.open(checkoutData.url, '_blank', 'noopener,noreferrer');
        setMessage('Stripe checkout opened in a new tab.');
      } else {
        setMessage('Secure payment link created. Copy and send it to the guest.');
      }
    } catch (error) {
      console.error('Admin booking flow failed:', error);
      setMessage('Something went wrong creating the booking payment flow.');
    } finally {
      setBusy(false);
    }
  }

  async function copyPaymentLink() {
    if (!paymentUrl) {
      setMessage('No payment link to copy yet.');
      return;
    }

    try {
      await navigator.clipboard.writeText(paymentUrl);
      setMessage('Payment link copied to clipboard.');
    } catch (error) {
      console.error('Copy failed:', error);
      setMessage('Could not copy the payment link.');
    }
  }

  return (
    <div style={{ display: 'grid', gap: '24px' }}>
      <section style={cardStyle()}>
        <div style={{ marginBottom: '18px' }}>
          <h2
            style={{
              margin: 0,
              fontSize: '28px',
              color: '#0F3B5F',
            }}
          >
            New Admin Booking
          </h2>
          <p
            style={{
              margin: '8px 0 0 0',
              color: '#64748b',
              fontSize: '15px',
            }}
          >
            Create a reservation for a guest and take payment securely through Stripe.
          </p>
        </div>

        <div
          style={{
            display: 'grid',
            gap: '16px',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          }}
        >
          <div>
            <label style={{ display: 'block', marginBottom: '6px', fontWeight: 600 }}>
              Check-in
            </label>
            <input
              type="date"
              value={checkIn}
              onChange={(e) => setCheckIn(e.target.value)}
              style={{
                width: '100%',
                padding: '12px',
                borderRadius: '12px',
                border: '1px solid #cbd5e1',
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '6px', fontWeight: 600 }}>
              Check-out
            </label>
            <input
              type="date"
              value={checkOut}
              onChange={(e) => setCheckOut(e.target.value)}
              style={{
                width: '100%',
                padding: '12px',
                borderRadius: '12px',
                border: '1px solid #cbd5e1',
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '6px', fontWeight: 600 }}>
              Guests
            </label>
            <input
              type="number"
              min={1}
              max={12}
              value={guests}
              onChange={(e) => setGuests(Number(e.target.value))}
              style={{
                width: '100%',
                padding: '12px',
                borderRadius: '12px',
                border: '1px solid #cbd5e1',
              }}
            />
          </div>

          <div style={{ alignSelf: 'end' }}>
            <button
              onClick={searchAvailability}
              disabled={busy}
              style={{
                width: '100%',
                padding: '12px 16px',
                borderRadius: '999px',
                border: '1px solid #0F3B5F',
                background: '#0F3B5F',
                color: '#fff',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              {busy ? 'Searching...' : 'Search Rooms'}
            </button>
          </div>
        </div>
      </section>

      <section style={cardStyle()}>
        <h3
          style={{
            marginTop: 0,
            marginBottom: '16px',
            fontSize: '22px',
            color: '#0F3B5F',
          }}
        >
          Guest Information
        </h3>

        <div
          style={{
            display: 'grid',
            gap: '16px',
            gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          }}
        >
          <div>
            <label style={{ display: 'block', marginBottom: '6px', fontWeight: 600 }}>
              First name
            </label>
            <input
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              style={{
                width: '100%',
                padding: '12px',
                borderRadius: '12px',
                border: '1px solid #cbd5e1',
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '6px', fontWeight: 600 }}>
              Last name
            </label>
            <input
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              style={{
                width: '100%',
                padding: '12px',
                borderRadius: '12px',
                border: '1px solid #cbd5e1',
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '6px', fontWeight: 600 }}>
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={{
                width: '100%',
                padding: '12px',
                borderRadius: '12px',
                border: '1px solid #cbd5e1',
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '6px', fontWeight: 600 }}>
              Phone
            </label>
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              style={{
                width: '100%',
                padding: '12px',
                borderRadius: '12px',
                border: '1px solid #cbd5e1',
              }}
            />
          </div>
        </div>
      </section>

      <section style={cardStyle()}>
        <h3
          style={{
            marginTop: 0,
            marginBottom: '16px',
            fontSize: '22px',
            color: '#0F3B5F',
          }}
        >
          Available Rooms
        </h3>

        {!availableRooms.length ? (
          <p style={{ margin: 0, color: '#64748b' }}>
            Search dates first to load available rooms.
          </p>
        ) : (
          <div style={{ display: 'grid', gap: '14px' }}>
            {availableRooms.map((room) => (
              <label
                key={room.id}
                style={{
                  display: 'grid',
                  gridTemplateColumns:
                    room.image_url || room.cover_image_url ? '180px 1fr auto' : '1fr auto',
                  gap: '16px',
                  alignItems: 'stretch',
                  border: selectedRoomId === room.id ? '2px solid #0F3B5F' : '1px solid #e2e8f0',
                  borderRadius: '18px',
                  overflow: 'hidden',
                  background: '#fff',
                  cursor: 'pointer',
                }}
              >
                {room.image_url || room.cover_image_url ? (
                  <div style={{ background: '#e2e8f0', minHeight: '140px' }}>
                    <img
                      src={room.image_url || room.cover_image_url || ''}
                      alt={room.name}
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                        display: 'block',
                      }}
                    />
                  </div>
                ) : null}

                <div style={{ padding: '16px 0' }}>
                  <div
                    style={{
                      fontSize: '20px',
                      fontWeight: 700,
                      color: '#0f172a',
                    }}
                  >
                    {room.name}
                  </div>
                  <div
                    style={{
                      marginTop: '6px',
                      color: '#64748b',
                      fontSize: '14px',
                    }}
                  >
                    {room.room_type ?? 'Room'}
                    {room.max_guests ? ` · Up to ${room.max_guests} guests` : ''}
                  </div>
                  <div style={{ marginTop: '10px', color: '#334155', fontSize: '14px' }}>
                    {room.description ?? ''}
                  </div>
                  <div
                    style={{
                      marginTop: '12px',
                      fontWeight: 700,
                      color: '#0f172a',
                    }}
                  >
                    {money(getRoomRate(room))} / night
                  </div>
                </div>

                <div
                  style={{
                    padding: '16px',
                    display: 'flex',
                    alignItems: 'start',
                    justifyContent: 'center',
                  }}
                >
                  <input
                    type="radio"
                    name="admin-room"
                    checked={selectedRoomId === room.id}
                    onChange={() => setSelectedRoomId(room.id)}
                  />
                </div>
              </label>
            ))}
          </div>
        )}
      </section>

      <section style={cardStyle()}>
        <h3
          style={{
            marginTop: 0,
            marginBottom: '16px',
            fontSize: '22px',
            color: '#0F3B5F',
          }}
        >
          Booking Summary
        </h3>

        <div
          style={{
            display: 'grid',
            gap: '10px',
            marginBottom: '18px',
            color: '#334155',
          }}
        >
          <div>
            <strong>Guest:</strong>{' '}
            {firstName || lastName ? `${firstName} ${lastName}`.trim() : '—'}
          </div>
          <div>
            <strong>Email:</strong> {email || '—'}
          </div>
          <div>
            <strong>Phone:</strong> {phone || '—'}
          </div>
          <div>
            <strong>Room:</strong> {selectedRoom?.name ?? '—'}
          </div>
          <div>
            <strong>Stay:</strong> {checkIn} → {checkOut}
          </div>
          <div>
            <strong>Nights:</strong> {nights}
          </div>
          <div>
            <strong>Nightly rate:</strong> {money(roomRate)}
          </div>
          <div>
            <strong>Total to charge:</strong> {money(estimatedTotal)}
          </div>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
          <button
            onClick={() => createPaymentSession(true)}
            disabled={busy}
            style={{
              padding: '12px 18px',
              borderRadius: '999px',
              border: '1px solid #0F3B5F',
              background: '#0F3B5F',
              color: '#fff',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            {busy ? 'Working...' : 'Open Stripe Payment Page'}
          </button>

          <button
            onClick={() => createPaymentSession(false)}
            disabled={busy}
            style={{
              padding: '12px 18px',
              borderRadius: '999px',
              border: '1px solid #cbd5e1',
              background: '#fff',
              color: '#334155',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Generate Payment Link
          </button>

          <button
            onClick={copyPaymentLink}
            disabled={!paymentUrl}
            style={{
              padding: '12px 18px',
              borderRadius: '999px',
              border: '1px solid #cbd5e1',
              background: paymentUrl ? '#fff' : '#f8fafc',
              color: paymentUrl ? '#334155' : '#94a3b8',
              fontWeight: 700,
              cursor: paymentUrl ? 'pointer' : 'not-allowed',
            }}
          >
            Copy Payment Link
          </button>
        </div>

        {paymentUrl ? (
          <div
            style={{
              marginTop: '18px',
              padding: '14px',
              borderRadius: '14px',
              background: '#eff6ff',
              color: '#1e3a8a',
              wordBreak: 'break-all',
              fontSize: '14px',
            }}
          >
            <strong>Payment link:</strong>
            <div style={{ marginTop: '8px' }}>{paymentUrl}</div>
          </div>
        ) : null}

        {message ? (
          <div
            style={{
              marginTop: '16px',
              padding: '14px',
              borderRadius: '14px',
              background: '#f8fafc',
              color: '#334155',
            }}
          >
            {message}
          </div>
        ) : null}
      </section>
    </div>
  );
}