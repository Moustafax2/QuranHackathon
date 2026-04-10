import { NextResponse } from "next/server";
import { getUsableSession } from "@/lib/qf-user/session";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const cookieCarrier = new NextResponse();
  const session = await getUsableSession(cookieCarrier.cookies);
  if (!session) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const { id } = await params;
  const updates = await request.json().catch(() => null);
  if (!updates) {
    return NextResponse.json({ error: "Invalid body." }, { status: 400 });
  }

  const supabase = createAdminSupabaseClient();
  const dbUpdates: Record<string, unknown> = {};
  if (updates.word_id !== undefined) dbUpdates.word_id = updates.word_id;
  if (updates.status !== undefined) dbUpdates.status = updates.status;
  if (updates.fsrs_state !== undefined) dbUpdates.fsrs_state = updates.fsrs_state;

  const { error } = await supabase
    .from("user_flashcards")
    .update(dbUpdates)
    .eq("id", id)
    .eq("user_id", session.player_id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true }, { headers: cookieCarrier.headers });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const cookieCarrier = new NextResponse();
  const session = await getUsableSession(cookieCarrier.cookies);
  if (!session) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const { id } = await params;
  const supabase = createAdminSupabaseClient();
  const { error } = await supabase
    .from("user_flashcards")
    .delete()
    .eq("id", id)
    .eq("user_id", session.player_id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true }, { headers: cookieCarrier.headers });
}
