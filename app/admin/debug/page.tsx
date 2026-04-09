import { createClient } from "../../../lib/supabase/server";

export default async function AdminDebugPage() {
  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  let profile: any = null;
  let profileError: string | null = null;

  if (user) {
    const result = await supabase
      .from("profiles")
      .select("id, email, role")
      .eq("id", user.id)
      .maybeSingle();

    profile = result.data;
    profileError = result.error ? result.error.message : null;
  }

  return (
    <main style={{ padding: "24px", fontFamily: "Arial, sans-serif" }}>
      <h1>Admin Debug</h1>

      <h2>Auth User</h2>
      <pre
        style={{
          background: "#f8fafc",
          padding: "16px",
          borderRadius: "12px",
          overflowX: "auto",
        }}
      >
        {JSON.stringify(
          {
            user: user
              ? {
                  id: user.id,
                  email: user.email,
                }
              : null,
            userError: userError ? userError.message : null,
          },
          null,
          2
        )}
      </pre>

      <h2>Profile Query</h2>
      <pre
        style={{
          background: "#f8fafc",
          padding: "16px",
          borderRadius: "12px",
          overflowX: "auto",
        }}
      >
        {JSON.stringify(
          {
            profile,
            profileError,
          },
          null,
          2
        )}
      </pre>
    </main>
  );
}