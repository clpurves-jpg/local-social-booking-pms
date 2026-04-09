import { redirect } from 'next/navigation';
import { requireRole } from '../../../lib/auth';
import { getSupabaseAdmin } from '../../../lib/supabase';
import { updateInventoryUnit } from '../actions';

function cardStyle(): React.CSSProperties {
  return {
    background: '#ffffff',
    borderRadius: '24px',
    padding: '24px',
    boxShadow: '0 8px 24px rgba(15, 23, 42, 0.08)',
  };
}

function inputStyle(): React.CSSProperties {
  return {
    width: '100%',
    padding: '10px 12px',
    borderRadius: '10px',
    border: '1px solid #cbd5e1',
    fontSize: '14px',
    color: '#0f172a',
    background: '#ffffff',
  };
}

function labelStyle(): React.CSSProperties {
  return {
    display: 'grid',
    gap: '6px',
    fontSize: '13px',
    fontWeight: 600,
    color: '#334155',
  };
}

function buttonStyle(): React.CSSProperties {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '10px 16px',
    borderRadius: '999px',
    border: 'none',
    background: '#0F3B5F',
    color: '#ffffff',
    fontSize: '14px',
    fontWeight: 700,
    cursor: 'pointer',
  };
}

type RoomRow = {
  id: string;
  name?: string | null;
  room_type?: string | null;
  slug?: string | null;
  nightly_rate?: number | null;
  base_rate?: number | null;
  price?: number | null;
  sort_order?: number | null;
  description?: string | null;
  image_url?: string | null;
  is_active?: boolean | null;
  active?: boolean | null;
  enabled?: boolean | null;
  inventory_type_code?: string | null;
};

export default async function AdminRoomsPage() {
  const profile = await requireRole(['admin']);

  if (!profile) {
    redirect('/admin/login');
  }

  const supabase = getSupabaseAdmin();

  const { data: rooms, error } = await supabase
    .from('inventory_units')
    .select('*')
    .order('sort_order', { ascending: true, nullsFirst: false });

  if (error) {
    throw new Error(`Failed to load rooms: ${error.message}`);
  }

  return (
    <div style={{ display: 'grid', gap: '24px' }}>
      <section style={cardStyle()}>
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
            marginBottom: '18px',
          }}
        >
          <div>
            <h2
              style={{
                margin: 0,
                fontSize: '28px',
                color: '#0F3B5F',
              }}
            >
              Rooms
            </h2>

            <p
              style={{
                margin: '8px 0 0 0',
                color: '#64748b',
                fontSize: '15px',
              }}
            >
              Manage rooms, RV spots, and inventory units.
            </p>

            <p
              style={{
                margin: '8px 0 0 0',
                color: '#94a3b8',
                fontSize: '13px',
              }}
            >
              Signed in as {profile.email} · {profile.role}
            </p>
          </div>
        </div>

        {!(rooms ?? []).length ? (
          <p style={{ margin: 0, color: '#64748b' }}>No rooms found.</p>
        ) : (
          <div style={{ display: 'grid', gap: '16px' }}>
            {(rooms ?? []).map((room: RoomRow) => {
              const activeValue =
                room.is_active ?? room.active ?? room.enabled ?? true;

              const nightlyRate =
                typeof room.nightly_rate === 'number'
                  ? room.nightly_rate
                  : typeof room.base_rate === 'number'
                    ? room.base_rate
                    : typeof room.price === 'number'
                      ? room.price
                      : 0;

              return (
                <form
  id={`room-form-${room.id}`}
  key={room.id}
  action={updateInventoryUnit}
                  style={{
                    border: '1px solid #e2e8f0',
                    borderRadius: '16px',
                    padding: '18px',
                    background: '#f8fafc',
                    display: 'grid',
                    gap: '16px',
                  }}
                >
                  <input type="hidden" name="id" value={room.id} />

                  <div
                    style={{
                      display: 'flex',
                      flexWrap: 'wrap',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '12px',
                    }}
                  >
                    <div>
                      <div
                        style={{
                          fontWeight: 700,
                          color: '#0f172a',
                          fontSize: '20px',
                        }}
                      >
                        {room.name ?? 'Unnamed Room'}
                      </div>

                      <div
                        style={{
                          marginTop: '4px',
                          fontSize: '13px',
                          color: '#64748b',
                        }}
                      >
                        ID: {room.id}
                      </div>
                    </div>

                    <div
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '8px',
                        fontSize: '14px',
                        color: '#334155',
                        fontWeight: 600,
                      }}
                    >
                      <span>Status</span>
                      <select
                        name="is_active"
                        defaultValue={String(Boolean(activeValue))}
                        style={{
                          ...inputStyle(),
                          width: 'auto',
                          minWidth: '120px',
                        }}
                      >
                        <option value="true">Active</option>
                        <option value="false">Inactive</option>
                      </select>
                    </div>
                  </div>

                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                      gap: '14px',
                    }}
                  >
                    <label style={labelStyle()}>
                      Room Name
                      <input
                        name="name"
                        defaultValue={room.name ?? ''}
                        style={inputStyle()}
                      />
                    </label>

                    <label style={labelStyle()}>
                      Room Type
                      <input
                        name="room_type"
                        defaultValue={room.room_type ?? room.inventory_type_code ?? ''}
                        style={inputStyle()}
                      />
                    </label>

                    <label style={labelStyle()}>
                      Slug
                      <input
                        name="slug"
                        defaultValue={room.slug ?? ''}
                        style={inputStyle()}
                      />
                    </label>

                    <label style={labelStyle()}>
                      Nightly Rate
                      <input
                        name="nightly_rate"
                        type="number"
                        step="0.01"
                        min="0"
                        defaultValue={nightlyRate}
                        style={inputStyle()}
                      />
                    </label>

                    <label style={labelStyle()}>
                      Sort Order
                      <input
                        name="sort_order"
                        type="number"
                        step="1"
                        defaultValue={room.sort_order ?? ''}
                        style={inputStyle()}
                      />
                    </label>
                  </div>

                  <label style={labelStyle()}>
                    Description
                    <textarea
                      name="description"
                      defaultValue={room.description ?? ''}
                      rows={4}
                      style={{
                        ...inputStyle(),
                        resize: 'vertical',
                        minHeight: '110px',
                      }}
                    />
                  </label>

                  <label style={labelStyle()}>
                    Image URL
                    <input
                      name="image_url"
                      defaultValue={room.image_url ?? ''}
                      placeholder="https://yourdomain.com/path/to/image.jpg"
                      style={inputStyle()}
                    />
                  </label>

                  {room.image_url ? (
                    <div style={{ display: 'grid', gap: '8px' }}>
                      <div
                        style={{
                          fontSize: '13px',
                          fontWeight: 600,
                          color: '#334155',
                        }}
                      >
                        Current Image Preview
                      </div>
                      <img
                        src={room.image_url}
                        alt={room.name ?? 'Room image'}
                        style={{
                          width: '100%',
                          maxWidth: '320px',
                          height: 'auto',
                          borderRadius: '14px',
                          border: '1px solid #e2e8f0',
                          objectFit: 'cover',
                        }}
                      />
                    </div>
                  ) : null}

                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'flex-end',
                    }}
                  >
                   <button
  type="submit"
  form={`room-form-${room.id}`}
  style={{
    padding: "10px 18px",
    borderRadius: "999px",
    border: "none",
    background: "#0F3B5F",
    color: "#ffffff",
    fontWeight: 700,
    cursor: "pointer",
  }}
>
  Save Room
</button>
                  </div>
                </form>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}