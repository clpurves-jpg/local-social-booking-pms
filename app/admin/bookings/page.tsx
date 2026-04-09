import { redirect } from "next/navigation";
import Link from "next/link";
import { requireRole } from "../../../lib/auth";
import { getSupabaseAdmin } from "../../../lib/supabase";
import { refundBookingAction, cancelBookingAction } from "../actions";
import ChargeButton from "@/components/admin/ChargeButton";

function formatDate(value?: string | null) {
  if (!value) return "—";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function formatMoney(value?: number | null) {
  const amount = typeof value === "number" ? value : 0;

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);
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
  } else if (normalized === "refunded") {
    background = "#dcfce7";
    color = "#166534";
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

export default async function AdminBookingsPage() {
  const profile = await requireRole(["admin"]);

  if (!profile) {
    redirect("/admin/login");
  }

  const supabase = getSupabaseAdmin();

  const [{ data: bookings, error: bookingsError }, { data: rooms, error: roomsError }] =
    await Promise.all([
      supabase
        .from("bookings")
        .select("*")
        .order("created_at", { ascending: false }),
      supabase
        .from("inventory_units")
        .select("id,name")
        .order("sort_order"),
    ]);

  if (bookingsError) {
    throw new Error(`Failed to load bookings: ${bookingsError.message}`);
  }

  if (roomsError) {
    throw new Error(`Failed to load rooms: ${roomsError.message}`);
  }

  const roomNameById = new Map<string, string>(
    (rooms ?? []).map((room: any) => [room.id, room.name])
  );

  return (
    <div style={{ display: "grid", gap: "24px" }}>
      <section style={cardStyle()}>
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "12px",
            marginBottom: "18px",
          }}
        >
          <div>
            <h2
              style={{
                margin: 0,
                fontSize: "28px",
                color: "#0F3B5F",
              }}
            >
              Bookings
            </h2>

            <p
              style={{
                margin: "8px 0 0 0",
                color: "#64748b",
                fontSize: "15px",
              }}
            >
              View reservations and manage guest stays.
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

          <Link
            href="/admin/bookings/new"
            style={{
              padding: "10px 18px",
              borderRadius: "999px",
              border: "1px solid #0F3B5F",
              background: "#0F3B5F",
              color: "#ffffff",
              textDecoration: "none",
              fontWeight: 700,
            }}
          >
            New Booking
          </Link>
        </div>

        {!(bookings ?? []).length ? (
          <p style={{ margin: 0, color: "#64748b" }}>No bookings found.</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                fontSize: "14px",
              }}
            >
              <thead>
                <tr style={{ borderBottom: "1px solid #e2e8f0" }}>
                  <th
                    style={{
                      textAlign: "left",
                      padding: "12px 0",
                      color: "#64748b",
                    }}
                  >
                    Confirmation
                  </th>
                  <th
                    style={{
                      textAlign: "left",
                      padding: "12px",
                      color: "#64748b",
                    }}
                  >
                    Guest
                  </th>
                  <th
                    style={{
                      textAlign: "left",
                      padding: "12px",
                      color: "#64748b",
                    }}
                  >
                    Room
                  </th>
                  <th
                    style={{
                      textAlign: "left",
                      padding: "12px",
                      color: "#64748b",
                    }}
                  >
                    Check-in
                  </th>
                  <th
                    style={{
                      textAlign: "left",
                      padding: "12px",
                      color: "#64748b",
                    }}
                  >
                    Check-out
                  </th>
                  <th
                    style={{
                      textAlign: "left",
                      padding: "12px",
                      color: "#64748b",
                    }}
                  >
                    Status
                  </th>
                  <th
                    style={{
                      textAlign: "left",
                      padding: "12px",
                      color: "#64748b",
                    }}
                  >
                    Total
                  </th>
                  <th
  style={{
    textAlign: "left",
    padding: "12px",
    color: "#64748b",
  }}
>
  Actions
</th>
                </tr>
              </thead>

              <tbody>
                {(bookings ?? []).map((booking: any) => {
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

                  const total =
                    typeof booking.gross_amount === "number"
                      ? booking.gross_amount
                      : typeof booking.total_amount === "number"
                      ? booking.total_amount
                      : typeof booking.total === "number"
                      ? booking.total
                      : 0;

                  return (
                    <tr
                      key={booking.id}
                      style={{ borderBottom: "1px solid #f1f5f9" }}
                    >
                      <td style={{ padding: "14px 0", color: "#0f172a" }}>
                        {booking.confirmation_code ?? booking.id ?? "—"}
                      </td>

                      <td style={{ padding: "14px 12px", color: "#334155" }}>
                        <div style={{ fontWeight: 600, color: "#0f172a" }}>
                          {guestName}
                        </div>
                        <div
                          style={{
                            marginTop: "4px",
                            fontSize: "12px",
                            color: "#64748b",
                          }}
                        >
                          {booking.guest_email ?? "—"}
                        </div>
                      </td>

                      <td style={{ padding: "14px 12px", color: "#334155" }}>
                        {roomName}
                      </td>

                      <td style={{ padding: "14px 12px", color: "#334155" }}>
                        {formatDate(booking.check_in_date ?? booking.check_in)}
                      </td>

                      <td style={{ padding: "14px 12px", color: "#334155" }}>
                        {formatDate(booking.check_out_date ?? booking.check_out)}
                      </td>

                      <td style={{ padding: "14px 12px" }}>
                        <span style={statusStyle(booking.status)}>
                          {booking.status ?? "—"}
                        </span>
                      </td>

                      <td
                        style={{
                          padding: "14px 12px",
                          color: "#334155",
                          fontWeight: 600,
                        }}
                      >
                        {formatMoney(total)}
                      </td>

                      <td style={{ padding: "14px 12px" }}>
                        {booking.status !== "refunded" &&
                        booking.status !== "cancelled" ? (
                          <div
                            style={{
                              display: "flex",
                              flexDirection: "column",
                              gap: "8px",
                            }}
                          >
                            <form
                              action={refundBookingAction}
                              style={{
                                display: "flex",
                                flexDirection: "column",
                                gap: "6px",
                              }}
                            >
                              <input
                                type="hidden"
                                name="booking_id"
                                value={booking.id}
                              />

                              <input
                                type="number"
                                name="refund_amount"
                                step="0.01"
                                min="0"
                                placeholder="Partial refund"
                                style={{
                                  padding: "6px 8px",
                                  borderRadius: "6px",
                                  border: "1px solid #cbd5e1",
                                  fontSize: "12px",
                                  width: "120px",
                                }}
                              />

                              <button
                                type="submit"
                                style={{
                                  padding: "6px 10px",
                                  borderRadius: "999px",
                                  border: "none",
                                  background: "#dc2626",
                                  color: "#fff",
                                  fontWeight: 600,
                                  fontSize: "12px",
                                  cursor: "pointer",
                                }}
                              >
                                Refund
                              </button>
                            </form>

                            <form action={cancelBookingAction}>
                              <input
                                type="hidden"
                                name="booking_id"
                                value={booking.id}
                              />

                              <button
                                type="submit"
                                style={{
                                  padding: "6px 10px",
                                  borderRadius: "999px",
                                  border: "1px solid #cbd5e1",
                                  background: "#ffffff",
                                  color: "#334155",
                                  fontWeight: 600,
                                  fontSize: "12px",
                                  cursor: "pointer",
                                }}
                              >
                                Cancel Only
                              </button>
                            </form>
                          <ChargeButton bookingId={booking.id} />
                          </div>
                        ) : (
                          <span
                            style={{
                              fontSize: "12px",
                              fontWeight: 600,
                              color:
                                booking.status === "refunded"
                                  ? "#166534"
                                  : "#991b1b",
                            }}
                          >
                            {booking.status === "refunded"
                              ? "Refunded"
                              : booking.status === "cancelled"
                              ? "Cancelled"
                              : booking.status}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}