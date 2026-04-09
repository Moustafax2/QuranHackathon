import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

const GUEST_COOKIE = "qalamspace_guest_player_id";

export async function POST(request: NextRequest) {
  // If caller already has a guest ID cookie, verify it exists and return it
  const existingId = request.cookies.get(GUEST_COOKIE)?.value;
  if (existingId) {
    const supabase = createAdminSupabaseClient();
    const { data: existing } = await supabase
      .from("players")
      .select("id, display_name")
      .eq("id", existingId)
      .single();

    if (existing) {
      return NextResponse.json(existing);
    }
    // Cookie pointed to a deleted row — fall through to create new guest
  }

  const supabase = createAdminSupabaseClient();
  const guestNumber = Math.floor(1000 + Math.random() * 9000);

  const { data, error } = await supabase
    .from("players")
    .insert({ display_name: `Guest ${guestNumber}` })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const response = NextResponse.json(data);
  response.cookies.set(GUEST_COOKIE, data.id, {
    httpOnly: true,
    sameSite: "strict",
    path: "/",
    maxAge: 60 * 60 * 24 * 7, // 1 week
  });

  return response;
}
