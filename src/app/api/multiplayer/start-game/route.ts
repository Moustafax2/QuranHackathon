import { NextResponse } from "next/server";
import { resolvePlayerId } from "@/lib/multiplayer/resolve-player";
import { invokeSupabaseEdgeFunction } from "@/lib/multiplayer/server";

export async function POST(request: Request) {
  const cookieCarrier = new NextResponse();
  const playerId = await resolvePlayerId(request, cookieCarrier.cookies);
  if (!playerId) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as { room_id?: string } | null;
  if (!body?.room_id) {
    return NextResponse.json({ error: "room_id is required." }, { status: 400 });
  }

  try {
    const data = await invokeSupabaseEdgeFunction<{ game_id: string; total_rounds: number }>(
      "start-game",
      {
        room_id: body.room_id,
        player_id: playerId,
      }
    );
    return NextResponse.json(data, { headers: cookieCarrier.headers });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to start game." },
      { status: 500, headers: cookieCarrier.headers }
    );
  }
}
