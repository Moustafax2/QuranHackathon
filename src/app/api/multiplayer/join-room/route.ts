import { NextResponse } from "next/server";
import { resolvePlayerId } from "@/lib/multiplayer/resolve-player";

function normalizeEnvValue(value: string | undefined): string | null {
  const normalized = value?.trim().replace(/^['"]|['"]$/g, "");
  return normalized ? normalized : null;
}

function isJwtLikeToken(value: string): boolean {
  // Heuristic only: if key looks like a JWT (header.payload.signature), include
  // Authorization in addition to apikey; Supabase still validates credentials.
  return /^[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+$/.test(value);
}

export async function POST(request: Request) {
  const cookieCarrier = new NextResponse();
  const playerId = await resolvePlayerId(request, cookieCarrier.cookies);
  if (!playerId) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as { room_code?: string } | null;
  if (!body?.room_code) {
    return NextResponse.json({ error: "room_code is required." }, { status: 400 });
  }

  try {
    const supabaseUrl = normalizeEnvValue(process.env.NEXT_PUBLIC_SUPABASE_URL);
    const serviceRoleKey = normalizeEnvValue(process.env.SUPABASE_SERVICE_ROLE_KEY);
    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json(
        { error: "Missing Supabase edge function configuration." },
        { status: 500, headers: cookieCarrier.headers }
      );
    }

    const headers: HeadersInit = {
      apikey: serviceRoleKey,
      "Content-Type": "application/json",
    };
    if (isJwtLikeToken(serviceRoleKey)) {
      headers.Authorization = `Bearer ${serviceRoleKey}`;
    }

    const edgeResponse = await fetch(`${supabaseUrl}/functions/v1/join-room`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        player_id: playerId,
        room_code: body.room_code,
      }),
      cache: "no-store",
    });

    const raw = await edgeResponse
      .text()
      .catch(() => '{"error":"Failed to read edge function response."}');
    let parsed: Record<string, unknown> = {};
    if (raw) {
      try {
        parsed = JSON.parse(raw) as Record<string, unknown>;
      } catch {
        parsed = { error: raw };
      }
    }

    return NextResponse.json(parsed, {
      status: edgeResponse.status,
      headers: cookieCarrier.headers,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to join room." },
      { status: 500, headers: cookieCarrier.headers }
    );
  }
}
