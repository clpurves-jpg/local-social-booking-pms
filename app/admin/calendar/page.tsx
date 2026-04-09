import { redirect } from "next/navigation";
import { requireRole } from "../../../lib/auth";
import { getSupabaseAdmin } from "../../../lib/supabase";

function formatDate(value?: string | null) {
  if (!value) return "—";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function cardStyle(): React.CSSProperties {
  return {
    background: "#ffffff",
    borderRadius: "24px",
    padding: "24px",
    boxShadow: "0 8px 24px rgba(15, 23, 42, 0.08)",
  };
}

function statusStyle(status?: string | null): React.CSSProperties {
  const normalized = (status ?? "").toLowerCase();

  let background = "#e2e8f0";
  let color = "#334155";

  if (normalized === "confirmed") {
    background = "#dcfce7";
    color = "#166534";
  } else if (normalized === "checked_in") {
    background = "#dbeafe";
    color = "#1d4ed8";
  } else if (normalized === "hold") {
    background = "#fef3c7";
    color = "#92400e";
  } else if (normalized === "cancelled") {
    background = "#fee2e2";
    color = "#991b1b";
  }

  return {
    display: "inline-block",
    padding: "6px 10px",
    borderRadius: "999px",
    background,
    color,
    fontSize: "12px",
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: "0.04em",
  };
}

export default async function AdminCalendarPage() {
  const profile = await requireRole(["admin"]);

 if (!profile) {
  redirect("/admin/login");
}

  const supabase = getSupabaseAdmin();

  const [{ data: bookings }, { data: rooms }] = await Promise.all([
    supabase
      .from("bookings")
      .select("*")
      .order("check_in_date", { ascending: true }),
    supabase
      .from("inventory_units")
      .select("id,name")
      .order("sort_order"),
  ]);

  const roomNameById = new Map<string, string>(
    (rooms ?? []).map((room: any) => [room.id, room.name])
  );

  const sortedBookings = [...(bookings ?? [])].sort((a: any, b: any) => {
    const aDate = new Date(a.check_in_date ?? a.check_in ?? 0).getTime();
    const bDate = new Date(b.check_in_date ?? b.check_in ?? 0).getTime();
    return aDate - bDate;
  });

  return (
    <div style={{ display: "grid", gap: "24px" }}>
      <section style={cardStyle()}>
        <div style={{ marginBottom: "18px" }}>
          <h2
            style={{
              margin: 0,
              fontSize: "28px",
              color: "#0F3B5F",
            }}
          >
            Calendar
          </h2>

          <p
            style={{
              margin: "8px 0 0 0",
              color: "#64748b",
              fontSize: "15px",
            }}
          >
            Upcoming arrivals and departures.
          </p>

          <p
            style={{
              margin: "8px 0 0 0",
              color: "#94a3b8",
              fontSize: "13px",
            }}
          >
            Signed in as {profile.email} · {profile.role}
          </p>
        </div>

        {sortedBookings.length === 0 ? (
          <p style={{ margin: 0, color: "#64748b" }}>No bookings found.</p>
        ) : (
          <div style={{ display: "grid", gap: "14px" }}>
            {sortedBookings.map((booking: any) => {
              const guestName =
                booking.guest_name ||
                [booking.guest_first_name, booking.guest_last_name]
                  .filter(Boolean)
                  .join(" ") ||
                booking.guest_email ||
                "Guest";

              const roomId =
                booking.inventory_id ??
                booking.inventory_unit_id ??
                booking.room_id;

              const roomName = roomNameById.get(roomId) ?? "Room";

              return (
                <div
                  key={booking.id}
                  style={{
                    border: "1px solid #e2e8f0",
                    borderRadius: "16px",
                    padding: "16px",
                    background: "#f8fafc",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: "10px",
                      marginBottom: "10px",
                    }}
                  >
                    <div style={{ fontWeight: 700, color: "#0f172a" }}>
                      {guestName}
                    </div>

                    <span style={statusStyle(booking.status)}>
                      {booking.status ?? "—"}
                    </span>
                  </div>

                  <div
                    style={{
                      display: "grid",
                      gap: "6px",
                      color: "#334155",
                      fontSize: "14px",
                    }}
                  >
                    <div>
                      <strong>Room:</strong> {roomName}
                    </div>
                    <div>
                      <strong>Check-in:</strong>{" "}
                      {formatDate(booking.check_in_date ?? booking.check_in)}
                    </div>
                    <div>
                      <strong>Check-out:</strong>{" "}
                      {formatDate(booking.check_out_date ?? booking.check_out)}
                    </div>
                    <div>
                      <strong>Email:</strong> {booking.guest_email ?? "—"}
                    </div>
                    <div>
                      <strong>Confirmation:</strong>{" "}
                      {booking.confirmation_code ?? booking.id ?? "—"}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}