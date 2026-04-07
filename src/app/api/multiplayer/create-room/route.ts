import { NextResponse } from "next/server";
import { getUsableSession } from "@/lib/qf-user/session";
import { invokeSupabaseEdgeFunction } from "@/lib/multiplayer/server";

export async function POST(request: Request) {
  const cookieCarrier = new NextResponse();
  const session = await getUsableSession(cookieCarrier.cookies);
  if (!session) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as
    | { game_mode?: string; settings?: Record<string, unknown> }
    | null;

  if (!body?.game_mode) {
    return NextResponse.json({ error: "game_mode is required." }, { status: 400 });
  }

  try {
    const data = await invokeSupabaseEdgeFunction<{ room_id: string; code: string }>(
      "create-room",
      {
        player_id: session.player_id,
        game_mode: body.game_mode,
        settings: body.settings,
      }
    );
    return NextResponse.json(data, { headers: cookieCarrier.headers });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create room." },
      { status: 500, headers: cookieCarrier.headers }
    );
  }
}
