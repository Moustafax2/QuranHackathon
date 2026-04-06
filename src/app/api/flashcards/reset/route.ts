import { NextResponse } from "next/server";
import { getUsableSession } from "@/lib/qf-user/session";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

export async function DELETE() {
  const cookieCarrier = new NextResponse();
  const session = await getUsableSession(cookieCarrier.cookies);
  if (!session) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const supabase = createAdminSupabaseClient();
  const userId = session.player_id;

  await supabase.from("review_log").delete().eq("user_id", userId);
  await supabase.from("user_flashcards").delete().eq("user_id", userId);
  await supabase.from("user_preferences").delete().eq("user_id", userId);

  return NextResponse.json({ ok: true }, { headers: cookieCarrier.headers });
}
