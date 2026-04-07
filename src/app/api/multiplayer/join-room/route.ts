import { NextResponse } from "next/server";
import { getUsableSession } from "@/lib/qf-user/session";
import { invokeSupabaseEdgeFunction } from "@/lib/multiplayer/server";

export async function POST(request: Request) {
  const cookieCarrier = new NextResponse();
  const session = await getUsableSession(cookieCarrier.cookies);
  if (!session) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as { room_code?: string } | null;
  if (!body?.room_code) {
    return NextResponse.json({ error: "room_code is required." }, { status: 400 });
  }

  try {
    const data = await invokeSupabaseEdgeFunction<{
      room_id: string;
      code: string;
      host_id: string;
      game_mode: string;
      settings: Record<string, unknown>;
    }>("join-room", {
      player_id: session.player_id,
      room_code: body.room_code,
    });
    return NextResponse.json(data, { headers: cookieCarrier.headers });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to join room." },
      { status: 500, headers: cookieCarrier.headers }
    );
  }
}
