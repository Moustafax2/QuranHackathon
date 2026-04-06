import { NextResponse } from "next/server";
import { getUsableSession } from "@/lib/qf-user/session";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

export async function GET() {
  const cookieCarrier = new NextResponse();
  const session = await getUsableSession(cookieCarrier.cookies);
  if (!session) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("user_preferences")
    .select("*")
    .eq("user_id", session.player_id)
    .single();

  if (error || !data) {
    return NextResponse.json(null, { headers: cookieCarrier.headers });
  }

  return NextResponse.json(data, { headers: cookieCarrier.headers });
}

export async function PUT(request: Request) {
  const cookieCarrier = new NextResponse();
  const session = await getUsableSession(cookieCarrier.cookies);
  if (!session) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const prefs = await request.json().catch(() => null);
  if (!prefs) {
    return NextResponse.json({ error: "Invalid body." }, { status: 400 });
  }

  const supabase = createAdminSupabaseClient();
  const { error } = await supabase.from("user_preferences").upsert(
    {
      user_id: session.player_id,
      show_arabic_explanation: prefs.show_arabic_explanation,
      show_root: prefs.show_root,
      show_ayah_examples: prefs.show_ayah_examples,
      include_particles: prefs.include_particles,
      include_proper_nouns: prefs.include_proper_nouns,
      auto_audio: prefs.auto_audio,
      show_transliteration: prefs.show_transliteration,
      daily_new_cards_limit: prefs.daily_new_cards_limit,
      daily_review_cards_limit: prefs.daily_review_cards_limit,
      session_size: prefs.session_size,
      normalization_level: prefs.normalization_level,
    },
    { onConflict: "user_id" }
  );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true }, { headers: cookieCarrier.headers });
}
