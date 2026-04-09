import { redirect } from "next/navigation";
import { requireRole } from "../../lib/auth";
import { getSupabaseAdmin } from "../../lib/supabase";

function formatDateTime(value?: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleString();
}

export default async function AdminPage() {
  const profile = await requireRole(["admin"]);

if (!profile) {
  redirect("/admin/login");
}

  const supabase = getSupabaseAdmin();

  const [{ data: holds }, { data: bookings }] = await Promise.all([
    supabase
      .from("booking_holds")
      .select("*")
      .eq("status", "held")
      .order("created_at", { ascending: false }),

    supabase
      .from("bookings")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  return (
    <main style={{ padding: "24px", fontFamily: "Arial, sans-serif" }}>
      <div style={{ marginBottom: "24px" }}>
        <h1 style={{ margin: 0 }}>Admin Dashboard</h1>
        <div style={{ marginTop: "6px", color: "#64748b", fontSize: "14px" }}>
          Signed in as {profile.email} · {profile.role}
        </div>
      </div>

      <section style={{ marginBottom: "40px" }}>
        <h2>Active Holds</h2>
        {!holds?.length ? (
          <p>No active holds.</p>
        ) : (
          <div style={{ display: "grid", gap: "12px", marginTop: "12px" }}>
            {holds.map((hold: any) => (
              <div
                key={hold.id}
                style={{
                  border: "1px solid #ddd",
                  borderRadius: "8px",
                  padding: "12px",
                }}
              >
                <div><strong>ID:</strong> {hold.id}</div>
                <div><strong>Guest:</strong> {hold.first_name} {hold.last_name}</div>
                <div><strong>Email:</strong> {hold.email}</div>
                <div><strong>Check-in:</strong> {hold.check_in}</div>
                <div><strong>Check-out:</strong> {hold.check_out}</div>
                <div><strong>Created:</strong> {formatDateTime(hold.created_at)}</div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2>Recent Bookings</h2>
        {!bookings?.length ? (
          <p>No bookings found.</p>
        ) : (
          <div style={{ display: "grid", gap: "12px", marginTop: "12px" }}>
            {bookings.map((booking: any) => (
              <div
                key={booking.id}
                style={{
                  border: "1px solid #ddd",
                  borderRadius: "8px",
                  padding: "12px",
                }}
              >
                <div><strong>ID:</strong> {booking.id}</div>
                <div><strong>Guest:</strong> {booking.first_name} {booking.last_name}</div>
                <div><strong>Email:</strong> {booking.email}</div>
                <div><strong>Check-in:</strong> {booking.check_in}</div>
                <div><strong>Check-out:</strong> {booking.check_out}</div>
                <div><strong>Created:</strong> {formatDateTime(booking.created_at)}</div>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}