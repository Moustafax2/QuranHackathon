import { NextRequest, NextResponse } from "next/server";
import { resolvePlayerId } from "@/lib/multiplayer/resolve-player";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

export async function GET(request: NextRequest) {
  const cookieCarrier = new NextResponse();
  const playerId = await resolvePlayerId(request, cookieCarrier.cookies);
  if (!playerId) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const gameId = request.nextUrl.searchParams.get("game_id");
  if (!gameId) {
    return NextResponse.json({ error: "game_id is required." }, { status: 400 });
  }

  const supabase = createAdminSupabaseClient();
  const { data: game } = await supabase
    .from("games")
    .select("room_id")
    .eq("id", gameId)
    .maybeSingle();

  if (!game) {
    return NextResponse.json({ error: "Game not found." }, { status: 404 });
  }

  const { data: membership } = await supabase
    .from("room_players")
    .select("player_id")
    .eq("room_id", game.room_id)
    .eq("player_id", playerId)
    .maybeSingle();

  if (!membership) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const [roomPlayersRes, participantsRes] = await Promise.all([
    supabase
      .from("room_players")
      .select("player_id")
      .eq("room_id", game.room_id),
    supabase
      .from("game_participants")
      .select("player_id, is_active, last_seen_at, became_inactive_at")
      .eq("game_id", gameId),
  ]);

  const playerIds = (roomPlayersRes.data ?? []).map((row) => row.player_id);
  const { data: players } = await supabase
    .from("players")
    .select("id, display_name")
    .in("id", playerIds);

  const presenceByPlayer = new Map(
    (participantsRes.data ?? []).map((row) => [row.player_id, row])
  );
  const playerById = new Map((players ?? []).map((row) => [row.id, row.display_name]));

  const data = playerIds.map((pid) => {
    const presence = presenceByPlayer.get(pid);
    return {
      player_id: pid,
      display_name: playerById.get(pid) ?? "Unknown",
      is_active: presence?.is_active ?? false,
      last_seen_at: presence?.last_seen_at ?? null,
      became_inactive_at: presence?.became_inactive_at ?? null,
    };
  });

  return NextResponse.json({ participants: data }, { headers: cookieCarrier.headers });
}
