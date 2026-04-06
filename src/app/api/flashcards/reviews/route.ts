import { NextResponse } from "next/server";
import { getUsableSession } from "@/lib/qf-user/session";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

export async function GET(request: Request) {
  const cookieCarrier = new NextResponse();
  const session = await getUsableSession(cookieCarrier.cookies);
  if (!session) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const supabase = createAdminSupabaseClient();

  let query = supabase
    .from("review_log")
    .select("*")
    .eq("user_id", session.player_id);

  const sessionId = searchParams.get("session_id");
  const wordId = searchParams.get("word_id");
  const rating = searchParams.get("rating");
  const startDate = searchParams.get("start_date");
  const endDate = searchParams.get("end_date");

  if (sessionId) query = query.eq("session_id", sessionId);
  if (wordId) query = query.eq("word_id", wordId);
  if (rating) query = query.eq("rating", Number(rating));
  if (startDate) query = query.gte("timestamp", startDate);
  if (endDate) query = query.lte("timestamp", endDate);

  query = query.order("timestamp", { ascending: false });

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data, { headers: cookieCarrier.headers });
}

export async function POST(request: Request) {
  const cookieCarrier = new NextResponse();
  const session = await getUsableSession(cookieCarrier.cookies);
  if (!session) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const log = await request.json().catch(() => null);
  if (!log) {
    return NextResponse.json({ error: "Invalid body." }, { status: 400 });
  }

  const supabase = createAdminSupabaseClient();
  const { error } = await supabase.from("review_log").insert({
    id: log.id,
    user_id: session.player_id,
    card_id: log.card_id,
    word_id: log.word_id,
    rating: log.rating,
    timestamp: log.timestamp,
    session_id: log.session_id,
    review_duration_ms: log.review_duration_ms ?? null,
    state_before: log.state_before,
    state_after: log.state_after,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true }, { headers: cookieCarrier.headers });
}
