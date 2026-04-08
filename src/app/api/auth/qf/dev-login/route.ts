import { NextRequest, NextResponse } from "next/server";
import type { QfSession } from "@/lib/qf-user/types";
import { clearQfCookies, writeSessionCookie } from "@/lib/qf-user/session";
import { isDevAuthEnabled } from "@/lib/qf-user/dev-auth";
import {
  getPlayerById,
  getPlayerByQfSub,
  listPlayersForDevAuth,
} from "@/lib/qf-user/user-profile";

function notAvailable() {
  return NextResponse.json({ error: "Dev auth is disabled." }, { status: 404 });
}

export async function GET() {
  if (!isDevAuthEnabled()) {
    return notAvailable();
  }

  const players = await listPlayersForDevAuth();
  return NextResponse.json({
    players: players.map((player) => ({
      id: player.id,
      quran_foundation_uid: player.quran_foundation_uid,
      display_name: player.display_name,
      qf_email: player.qf_email,
      created_at: player.created_at,
    })),
  });
}

export async function POST(request: NextRequest) {
  if (!isDevAuthEnabled()) {
    return notAvailable();
  }

  const body = (await request.json().catch(() => null)) as
    | { playerId?: string; qfSub?: string }
    | null;

  if (!body?.playerId && !body?.qfSub) {
    return NextResponse.json(
      { error: "Provide playerId or qfSub." },
      { status: 400 }
    );
  }

  const player = body.playerId
    ? await getPlayerById(body.playerId)
    : await getPlayerByQfSub(body.qfSub!);

  if (!player) {
    return NextResponse.json({ error: "Player not found." }, { status: 404 });
  }

  if (!player.quran_foundation_uid) {
    return NextResponse.json(
      { error: "Selected player is not linked to a Quran Foundation user." },
      { status: 400 }
    );
  }

  const session: QfSession = {
    access_token: "dev-access-token",
    refresh_token: null,
    id_token: "dev-id-token",
    expires_at: Date.now() + 1000 * 60 * 60 * 24 * 365,
    user: {
      sub: player.quran_foundation_uid,
      email: player.qf_email,
      name: player.display_name,
      avatar: player.avatar_url,
    },
    player_id: player.id,
  };

  const response = NextResponse.json({
    success: true,
    player: {
      id: player.id,
      quran_foundation_uid: player.quran_foundation_uid,
      display_name: player.display_name,
    },
  });

  clearQfCookies(response.cookies);
  await writeSessionCookie(response.cookies, session);

  return response;
}
