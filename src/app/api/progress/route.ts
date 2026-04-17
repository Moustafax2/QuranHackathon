import { NextResponse } from "next/server";
import { resolvePlayerId } from "@/lib/multiplayer/resolve-player";
import { getPlayerPlayProgress } from "@/lib/progress/play-server";

export async function GET(request: Request) {
  const cookieCarrier = new NextResponse();
  const playerId = await resolvePlayerId(request, cookieCarrier.cookies);
  if (!playerId) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  try {
    const payload = await getPlayerPlayProgress(playerId);
    return NextResponse.json(payload, { headers: cookieCarrier.headers });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load progress." },
      { status: 500, headers: cookieCarrier.headers }
    );
  }
}
