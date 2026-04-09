import Link from "next/link";

export default function UnauthorizedPage() {
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
          maxWidth: "520px",
          background: "#ffffff",
          borderRadius: "24px",
          padding: "32px",
          boxShadow: "0 8px 24px rgba(15, 23, 42, 0.08)",
          textAlign: "center",
        }}
      >
        <h1 style={{ margin: 0, color: "#0F3B5F" }}>Unauthorized</h1>

        <p style={{ margin: "12px 0 0 0", color: "#64748b" }}>
          You are signed in, but your account does not have permission to view this page.
        </p>

        <div style={{ marginTop: "20px" }}>
          <Link
            href="/book"
            style={{
              display: "inline-block",
              padding: "12px 20px",
              borderRadius: "999px",
              background: "#0F3B5F",
              color: "#ffffff",
              textDecoration: "none",
              fontWeight: 700,
            }}
          >
            Back to Booking
          </Link>
        </div>
      </div>
    </main>
  );
}