import { NextResponse } from "next/server";
import { resolvePlayerId } from "@/lib/multiplayer/resolve-player";
import { invokeSupabaseEdgeFunction } from "@/lib/multiplayer/server";
import { getUsableSession } from "@/lib/qf-user/session";
import { createGameInvitations } from "@/lib/social/invitations";

export async function POST(request: Request) {
  const cookieCarrier = new NextResponse();
  const playerId = await resolvePlayerId(request, cookieCarrier.cookies);
  if (!playerId) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as
    | {
        game_mode?: string;
        settings?: Record<string, unknown>;
        invitees?: Array<{
          id?: string;
          displayName?: string;
          username?: string | null;
          avatarUrl?: string | null;
        }>;
      }
    | null;

  if (!body?.game_mode) {
    return NextResponse.json({ error: "game_mode is required." }, { status: 400 });
  }

  try {
    const data = await invokeSupabaseEdgeFunction<{ room_id: string; code: string }>(
      "create-room",
      {
        player_id: playerId,
        game_mode: body.game_mode,
        settings: body.settings,
      }
    );

    const session = await getUsableSession(cookieCarrier.cookies);
    const invitees = (body.invitees ?? [])
      .filter((invitee) => Boolean(invitee?.id && invitee.displayName))
      .filter((invitee) => invitee.id !== session?.user.sub)
      .map((invitee) => ({
        qfUserId: invitee.id as string,
        displayName: invitee.displayName as string,
        username: invitee.username ?? null,
        avatarUrl: invitee.avatarUrl ?? null,
      }));

    if (session && invitees?.length) {
      await createGameInvitations({
        roomId: data.room_id,
        inviterPlayerId: session.player_id,
        recipients: invitees,
      });
    }

    return NextResponse.json(data, { headers: cookieCarrier.headers });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create room." },
      { status: 500, headers: cookieCarrier.headers }
    );
  }
}
