import { NextResponse } from "next/server";
import { getUsableSession, writeSessionCookie, clearQfCookies } from "@/lib/qf-user/session";
import { upsertPlayerFromQfUser } from "@/lib/qf-user/user-profile";

export async function GET() {
  const cookieCarrier = new NextResponse();

  const session = await getUsableSession(cookieCarrier.cookies);
  if (!session) {
    clearQfCookies(cookieCarrier.cookies);
    return NextResponse.json(
      {
        isAuthenticated: false,
        user: null,
        player: null,
      },
      { headers: cookieCarrier.headers }
    );
  }

  const player = await upsertPlayerFromQfUser(session.user);
  await writeSessionCookie(cookieCarrier.cookies, {
    ...session,
    player_id: player.id,
  });

  return NextResponse.json(
    {
      isAuthenticated: true,
      user: session.user,
      player,
    },
    {
      headers: cookieCarrier.headers,
    }
  );
}
