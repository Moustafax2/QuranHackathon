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
    .from("user_flashcards")
    .select("*")
    .eq("user_id", session.player_id)
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data, { headers: cookieCarrier.headers });
}

// Add a single card
export async function POST(request: Request) {
  const cookieCarrier = new NextResponse();
  const session = await getUsableSession(cookieCarrier.cookies);
  if (!session) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "Invalid body." }, { status: 400 });
  }

  const supabase = createAdminSupabaseClient();
  const { error } = await supabase.from("user_flashcards").upsert(
    {
      id: body.id,
      user_id: session.player_id,
      word_id: body.word_id,
      status: body.status,
      fsrs_state: body.fsrs_state,
      created_at: body.created_at,
      source_surah_id: body.source_surah_id ?? null,
      source_ayah_number: body.source_ayah_number ?? null,
      source_juz_number: body.source_juz_number ?? null,
      source_page_number: body.source_page_number ?? null,
    },
    { onConflict: "user_id,word_id" }
  );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true }, { headers: cookieCarrier.headers });
}

// Batch upsert
export async function PUT(request: Request) {
  const cookieCarrier = new NextResponse();
  const session = await getUsableSession(cookieCarrier.cookies);
  if (!session) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const cards = await request.json().catch(() => null);
  if (!Array.isArray(cards)) {
    return NextResponse.json({ error: "Expected an array." }, { status: 400 });
  }

  const supabase = createAdminSupabaseClient();
  const rows = cards.map((card) => ({
    id: card.id,
    user_id: session.player_id,
    word_id: card.word_id,
    status: card.status,
    fsrs_state: card.fsrs_state,
    created_at: card.created_at,
    source_surah_id: card.source_surah_id ?? null,
    source_ayah_number: card.source_ayah_number ?? null,
    source_juz_number: card.source_juz_number ?? null,
    source_page_number: card.source_page_number ?? null,
  }));

  const { error } = await supabase
    .from("user_flashcards")
    .upsert(rows, { onConflict: "user_id,word_id" });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true }, { headers: cookieCarrier.headers });
}
