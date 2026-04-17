import { NextResponse } from "next/server";
import { resolvePlayerId } from "@/lib/multiplayer/resolve-player";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

type AttemptBody = {
  client_attempt_id: string;
  mode: "ayah" | "page-blank";
  rating_level: number;
  verse_key?: string | null;
  surah_id?: number | null;
  ayah_number?: number | null;
  juz_number?: number | null;
  page_number?: number | null;
  selection_type?: "juz" | "surah" | null;
  cover_region?: "top" | "middle" | "bottom" | null;
  tested_at?: string;
};

function normalizeAttempt(playerId: string, attempt: AttemptBody) {
  return {
    player_id: playerId,
    client_attempt_id: attempt.client_attempt_id,
    mode: attempt.mode,
    rating_level: attempt.rating_level,
    verse_key: attempt.verse_key ?? null,
    surah_id: attempt.surah_id ?? null,
    ayah_number: attempt.ayah_number ?? null,
    juz_number: attempt.juz_number ?? null,
    page_number: attempt.page_number ?? null,
    selection_type: attempt.selection_type ?? null,
    cover_region: attempt.cover_region ?? null,
    tested_at: attempt.tested_at ?? new Date().toISOString(),
  };
}

async function resolvePlayer(request: Request, cookieCarrier: NextResponse) {
  const playerId = await resolvePlayerId(request, cookieCarrier.cookies);
  if (!playerId) {
    return null;
  }

  return playerId;
}

export async function GET(request: Request) {
  const cookieCarrier = new NextResponse();
  const playerId = await resolvePlayer(request, cookieCarrier);
  if (!playerId) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("memorization_attempts")
    .select("*")
    .eq("player_id", playerId)
    .order("tested_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(
    {
      player_id: playerId,
      attempts: data,
    },
    { headers: cookieCarrier.headers }
  );
}

export async function POST(request: Request) {
  const cookieCarrier = new NextResponse();
  const playerId = await resolvePlayer(request, cookieCarrier);
  if (!playerId) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as AttemptBody | null;
  if (!body?.client_attempt_id || !body.mode) {
    return NextResponse.json({ error: "Invalid memorization attempt." }, { status: 400 });
  }

  const supabase = createAdminSupabaseClient();
  const { error } = await supabase
    .from("memorization_attempts")
    .upsert(normalizeAttempt(playerId, body), {
      onConflict: "player_id,client_attempt_id",
    });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true }, { headers: cookieCarrier.headers });
}

export async function PUT(request: Request) {
  const cookieCarrier = new NextResponse();
  const playerId = await resolvePlayer(request, cookieCarrier);
  if (!playerId) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as AttemptBody[] | null;
  if (!Array.isArray(body)) {
    return NextResponse.json({ error: "Expected an array of attempts." }, { status: 400 });
  }

  const attempts = body
    .filter((attempt) => attempt.client_attempt_id && attempt.mode)
    .map((attempt) => normalizeAttempt(playerId, attempt));

  if (attempts.length === 0) {
    return NextResponse.json({ ok: true }, { headers: cookieCarrier.headers });
  }

  const supabase = createAdminSupabaseClient();
  const { error } = await supabase
    .from("memorization_attempts")
    .upsert(attempts, {
      onConflict: "player_id,client_attempt_id",
    });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true }, { headers: cookieCarrier.headers });
}

export async function DELETE(request: Request) {
  const cookieCarrier = new NextResponse();
  const playerId = await resolvePlayer(request, cookieCarrier);
  if (!playerId) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const supabase = createAdminSupabaseClient();
  const { error } = await supabase
    .from("memorization_attempts")
    .delete()
    .eq("player_id", playerId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true }, { headers: cookieCarrier.headers });
}
