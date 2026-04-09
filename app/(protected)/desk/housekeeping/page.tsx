import { redirect } from 'next/navigation';
import Link from 'next/link';
import { updateRoomStatusAction } from '@/app/(protected)/desk/actions';
import { createClient } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/supabase';

type RoomRow = {
  id: string;
  name: string | null;
  room_number: string | null;
  room_type: string | null;
  room_status: 'clean' | 'dirty' | 'inspected' | string | null;
};

function getStatusStyles(status: string | null | undefined): {
  label: string;
  badgeStyle: React.CSSProperties;
  cardStyle: React.CSSProperties;
} {
  const normalized = (status ?? '').toLowerCase();

  if (normalized === 'clean') {
    return {
      label: 'Clean',
      badgeStyle: {
        backgroundColor: '#dcfce7',
        color: '#166534',
        border: '1px solid #86efac',
      },
      cardStyle: {
        border: '1px solid #bbf7d0',
        boxShadow: '0 8px 24px rgba(22, 101, 52, 0.08)',
      },
    };
  }

  if (normalized === 'dirty') {
    return {
      label: 'Dirty',
      badgeStyle: {
        backgroundColor: '#fee2e2',
        color: '#991b1b',
        border: '1px solid #fca5a5',
      },
      cardStyle: {
        border: '1px solid #fecaca',
        boxShadow: '0 8px 24px rgba(153, 27, 27, 0.08)',
      },
    };
  }

  if (normalized === 'inspected') {
    return {
      label: 'Inspected',
      badgeStyle: {
        backgroundColor: '#fef9c3',
        color: '#854d0e',
        border: '1px solid #fde68a',
      },
      cardStyle: {
        border: '1px solid #fde68a',
        boxShadow: '0 8px 24px rgba(133, 77, 14, 0.08)',
      },
    };
  }

  return {
    label: 'Unknown',
    badgeStyle: {
      backgroundColor: '#e5e7eb',
      color: '#374151',
      border: '1px solid #d1d5db',
    },
    cardStyle: {
      border: '1px solid #e5e7eb',
      boxShadow: '0 8px 24px rgba(15, 23, 42, 0.05)',
    },
  };
}

function getRoomDisplayName(room: RoomRow): string {
  if (room.room_number && room.name) {
    return `${room.name} — ${room.room_number}`;
  }

  if (room.room_number) {
    return `Room ${room.room_number}`;
  }

  if (room.name) {
    return room.name;
  }

  return 'Unnamed Room';
}

export default async function DeskHousekeepingPage() {
  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    redirect('/login');
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();

  if (profileError) {
    throw new Error(`Failed to load profile: ${profileError.message}`);
  }

  const role = profile?.role ?? null;

  if (role !== 'admin' && role !== 'desk') {
    redirect('/unauthorized');
  }

  const adminSupabase = getSupabaseAdmin();

  const { data, error } = await adminSupabase
    .from('inventory_units')
    .select('id, name, room_number, room_type, room_status')
    .order('room_number', { ascending: true, nullsFirst: false })
    .order('name', { ascending: true });

  if (error) {
    throw new Error(`Failed to load housekeeping rooms: ${error.message}`);
  }

  const rooms: RoomRow[] = data ?? [];

  return (
    <main
      style={{
        padding: '24px',
        background: '#f8fafc',
        minHeight: '100vh',
      }}
    >
      <div
        style={{
          maxWidth: '1200px',
          margin: '0 auto',
        }}
      >
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '16px',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '24px',
          }}
        >
          <div>
            <h1
              style={{
                fontSize: '32px',
                lineHeight: 1.1,
                fontWeight: 700,
                color: '#0f172a',
                margin: 0,
              }}
            >
              Housekeeping
            </h1>
            <p
              style={{
                marginTop: '8px',
                marginBottom: 0,
                color: '#475569',
                fontSize: '16px',
              }}
            >
              Update room status instantly for the front desk and housekeeping team.
            </p>
          </div>

          <Link
            href="/desk"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '10px 16px',
              borderRadius: '999px',
              background: '#ffffff',
              color: '#0f172a',
              textDecoration: 'none',
              border: '1px solid #cbd5e1',
              fontWeight: 600,
            }}
          >
            Back to Desk
          </Link>
        </div>

        {rooms.length === 0 ? (
          <div
            style={{
              background: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: '20px',
              padding: '24px',
              color: '#334155',
            }}
          >
            No rooms found in inventory.
          </div>
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
              gap: '18px',
            }}
          >
            {rooms.map((room) => {
              const status = getStatusStyles(room.room_status);
              const roomName = getRoomDisplayName(room);

              return (
                <section
                  key={room.id}
                  style={{
                    background: '#ffffff',
                    borderRadius: '20px',
                    padding: '18px',
                    ...status.cardStyle,
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      justifyContent: 'space-between',
                      gap: '12px',
                      marginBottom: '14px',
                    }}
                  >
                    <div>
                      <h2
                        style={{
                          margin: 0,
                          fontSize: '20px',
                          fontWeight: 700,
                          color: '#0f172a',
                        }}
                      >
                        {roomName}
                      </h2>

                      <p
                        style={{
                          margin: '6px 0 0 0',
                          color: '#64748b',
                          fontSize: '14px',
                        }}
                      >
                        {room.room_type ?? 'Room'}
                      </p>
                    </div>

                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        whiteSpace: 'nowrap',
                        borderRadius: '999px',
                        padding: '6px 10px',
                        fontSize: '13px',
                        fontWeight: 700,
                        ...status.badgeStyle,
                      }}
                    >
                      {status.label}
                    </span>
                  </div>

                  <form action={updateRoomStatusAction}>
                    <input type="hidden" name="inventory_id" value={room.id} />

                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '1fr',
                        gap: '10px',
                      }}
                    >
                      <button
                        type="submit"
                        name="room_status"
                        value="clean"
                        style={{
                          border: '1px solid #86efac',
                          background: '#f0fdf4',
                          color: '#166534',
                          borderRadius: '12px',
                          padding: '11px 14px',
                          fontWeight: 700,
                          cursor: 'pointer',
                        }}
                      >
                        Mark Clean
                      </button>

                      <button
                        type="submit"
                        name="room_status"
                        value="dirty"
                        style={{
                          border: '1px solid #fca5a5',
                          background: '#fef2f2',
                          color: '#991b1b',
                          borderRadius: '12px',
                          padding: '11px 14px',
                          fontWeight: 700,
                          cursor: 'pointer',
                        }}
                      >
                        Mark Dirty
                      </button>

                      <button
                        type="submit"
                        name="room_status"
                        value="inspected"
                        style={{
                          border: '1px solid #fde68a',
                          background: '#fefce8',
                          color: '#854d0e',
                          borderRadius: '12px',
                          padding: '11px 14px',
                          fontWeight: 700,
                          cursor: 'pointer',
                        }}
                      >
                        Mark Inspected
                      </button>
                    </div>
                  </form>
                </section>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}