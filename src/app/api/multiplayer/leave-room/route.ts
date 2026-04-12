import { NextResponse } from "next/server";
import { resolvePlayerId } from "@/lib/multiplayer/resolve-player";
import { invokeSupabaseEdgeFunction } from "@/lib/multiplayer/server";

async function parseBody(request: Request): Promise<{ room_id?: string } | null> {
  const contentType = request.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    return (await request.json().catch(() => null)) as { room_id?: string } | null;
  }

  const raw = await request.text().catch(() => "");
  if (!raw) return null;

  const params = new URLSearchParams(raw);
  return { room_id: params.get("room_id") ?? undefined };
}

export async function POST(request: Request) {
  const cookieCarrier = new NextResponse();
  const playerId = await resolvePlayerId(request, cookieCarrier.cookies);

  if (!playerId) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const body = await parseBody(request);
  if (!body?.room_id) {
    return NextResponse.json({ error: "room_id is required." }, { status: 400 });
  }

  try {
    const data = await invokeSupabaseEdgeFunction<{ room_id: string; status: string }>(
      "leave-room",
      {
        room_id: body.room_id,
        player_id: playerId,
      },
    );

    return NextResponse.json(data, { headers: cookieCarrier.headers });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to leave room." },
      { status: 500, headers: cookieCarrier.headers },
    );
  }
}
