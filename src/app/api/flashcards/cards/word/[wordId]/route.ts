import { NextResponse } from "next/server";
import { getUsableSession } from "@/lib/qf-user/session";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ wordId: string }> }
) {
  const cookieCarrier = new NextResponse();
  const session = await getUsableSession(cookieCarrier.cookies);
  if (!session) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const { wordId } = await params;
  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("user_flashcards")
    .select("*")
    .eq("user_id", session.player_id)
    .eq("word_id", wordId)
    .single();

  if (error) {
    return NextResponse.json(null, { headers: cookieCarrier.headers });
  }

  return NextResponse.json(data, { headers: cookieCarrier.headers });
}
