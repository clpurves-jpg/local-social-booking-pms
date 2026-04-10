import Link from "next/link";

export default function AdminLoginPage() {
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        background: "#f8fafc",
        padding: "24px",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "420px",
          background: "#ffffff",
          borderRadius: "24px",
          padding: "32px",
          boxShadow: "0 8px 24px rgba(15, 23, 42, 0.08)",
          textAlign: "center",
        }}
      >
        <h1 style={{ margin: 0, color: "#0F3B5F" }}>
          High Desert Lodge Admin
        </h1>

        <p style={{ marginTop: "12px", color: "#64748b" }}>
          Staff login for reservations, front desk, and management tools.
        </p>

        <p style={{ marginTop: "8px", fontSize: "13px", color: "#94a3b8" }}>
          Powered by Local Social Booking & PMS
        </p>

        <div style={{ marginTop: "24px" }}>
          <Link
            href="/login"
            style={{
              display: "inline-block",
              padding: "12px 20px",
              borderRadius: "999px",
              background: "#6775b4",
              color: "#ffffff",
              textDecoration: "none",
              fontWeight: 700,
            }}
          >
            Go to Staff Login
          </Link>
        </div>
      </div>
    </main>
  );
}