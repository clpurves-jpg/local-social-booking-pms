import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";

async function runCleanup() {
  const supabase = getSupabaseAdmin();
  const cutoff = new Date(Date.now() - 15 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from("inventory_blocks")
    .delete()
    .eq("reason", "checkout_hold")
    .lt("created_at", cutoff)
    .select();

  if (error) {
    console.error("Cleanup error:", error);

    return NextResponse.json(
      {
        error: "Failed to cleanup expired holds",
        details: error.message,
      },
      { status: 500 }
    );
  }

  return NextResponse.json({
    cleaned: data?.length || 0,
    message: "Expired checkout holds removed",
  });
}

export async function GET() {
  try {
    return await runCleanup();
  } catch (err) {
    console.error("Cleanup server error:", err);

    return NextResponse.json(
      {
        error: "Server error during cleanup",
        details: err instanceof Error ? err.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

export async function POST() {
  try {
    return await runCleanup();
  } catch (err) {
    console.error("Cleanup server error:", err);

    return NextResponse.json(
      {
        error: "Server error during cleanup",
        details: err instanceof Error ? err.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
