import { NextRequest, NextResponse } from "next/server";
import { getUsableSession, writeSessionCookie, clearQfCookies } from "@/lib/qf-user/session";
import { upsertPlayerFromQfUser } from "@/lib/qf-user/user-profile";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

export async function GET(request: NextRequest) {
  const cookieCarrier = new NextResponse();

  const session = await getUsableSession(cookieCarrier.cookies);
  if (!session) {
    const guestId = request.cookies.get("qalamspace_guest_player_id")?.value;
    if (guestId) {
      const supabase = createAdminSupabaseClient();
      const { data: guestPlayer } = await supabase
        .from("players")
        .select("*")
        .eq("id", guestId)
        .maybeSingle();

      if (guestPlayer) {
        return NextResponse.json(
          {
            isAuthenticated: false,
            isGuest: true,
            user: null,
            player: guestPlayer,
          },
          { headers: cookieCarrier.headers }
        );
      }

      cookieCarrier.cookies.set("qalamspace_guest_player_id", "", {
        httpOnly: true,
        sameSite: "strict",
        path: "/",
        maxAge: 0,
      });
    }

    clearQfCookies(cookieCarrier.cookies);
    return NextResponse.json(
      {
        isAuthenticated: false,
        isGuest: false,
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
      isGuest: false,
      isAuthenticated: true,
      user: session.user,
      player,
    },
    {
      headers: cookieCarrier.headers,
    }
  );
}
