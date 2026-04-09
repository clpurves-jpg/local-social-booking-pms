import LoginForm from "../../login/LoginForm";

export default function BookLoginPage() {
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
        }}
      >
        <h1
          style={{
            margin: 0,
            marginBottom: "12px",
            color: "#0F3B5F",
            textAlign: "center",
          }}
        >
          Login
        </h1>

        <p
          style={{
            margin: "0 0 24px 0",
            color: "#64748b",
            textAlign: "center",
          }}
        >
          Sign in to continue.
        </p>

        <LoginForm />
      </div>
    </main>
  );
}