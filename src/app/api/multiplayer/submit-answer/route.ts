import { NextResponse } from "next/server";
import { resolvePlayerId } from "@/lib/multiplayer/resolve-player";
import { invokeSupabaseEdgeFunction } from "@/lib/multiplayer/server";

export async function POST(request: Request) {
  const cookieCarrier = new NextResponse();
  const playerId = await resolvePlayerId(request, cookieCarrier.cookies);
  if (!playerId) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as
    | {
        game_id?: string;
        round_id?: string;
        answer_verse_key?: string;
        is_buzzer?: boolean;
      }
    | null;

  if (!body?.game_id || !body.round_id) {
    return NextResponse.json({ error: "game_id and round_id are required." }, { status: 400 });
  }

  try {
    const data = await invokeSupabaseEdgeFunction<Record<string, unknown>>(
      "submit-answer",
      {
        game_id: body.game_id,
        round_id: body.round_id,
        player_id: playerId,
        answer_verse_key: body.answer_verse_key,
        is_buzzer: body.is_buzzer,
      }
    );
    return NextResponse.json(data, { headers: cookieCarrier.headers });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to submit answer." },
      { status: 500, headers: cookieCarrier.headers }
    );
  }
}
