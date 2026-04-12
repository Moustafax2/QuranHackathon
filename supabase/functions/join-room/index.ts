import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  createAdminClient,
  corsHeaders,
} from "../_shared/supabase-admin.ts";

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { player_id, room_code } = await req.json();

    if (!player_id || !room_code) {
      return new Response(
        JSON.stringify({ error: "player_id and room_code are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const admin = createAdminClient();

    // Find the room
    const { data: room, error: roomError } = await admin
      .from("rooms")
      .select("*")
      .eq("code", room_code.toUpperCase())
      .single();

    if (roomError || !room) {
      return new Response(
        JSON.stringify({ error: "Room not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if already in room first (rejoin eligibility)
    const { data: existing } = await admin
      .from("room_players")
      .select("player_id")
      .eq("room_id", room.id)
      .eq("player_id", player_id)
      .maybeSingle();

    const isExistingPlayer = Boolean(existing);
    const isRejoiningInProgress = room.status === "in_progress" && isExistingPlayer;

    if (room.status !== "lobby" && !isExistingPlayer) {
      return new Response(
        JSON.stringify({ error: "Cannot join new game already in progress" }),
        { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Keep max-player checks for lobby joins only
    if (room.status === "lobby" && !isExistingPlayer) {
      const { count } = await admin
        .from("room_players")
        .select("*", { count: "exact", head: true })
        .eq("room_id", room.id);

      if ((count ?? 0) >= 8) {
        return new Response(
          JSON.stringify({ error: "Room is full (max 8 players)" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    if (!isExistingPlayer) {
      // Add player to room
      const { error: joinError } = await admin
        .from("room_players")
        .insert({ room_id: room.id, player_id });

      if (joinError) {
        return new Response(
          JSON.stringify({ error: joinError.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    if (isRejoiningInProgress) {
      const { data: activeGame } = await admin
        .from("games")
        .select("id")
        .eq("room_id", room.id)
        .is("ended_at", null)
        .order("started_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (activeGame?.id) {
        await admin.from("game_participants").upsert({
          game_id: activeGame.id,
          player_id,
          is_active: true,
          last_seen_at: new Date().toISOString(),
        });
      }
    }

    return new Response(
      JSON.stringify({
        room_id: room.id,
        code: room.code,
        host_id: room.host_id,
        game_mode: room.game_mode,
        settings: room.settings,
        rejoined_in_progress: isRejoiningInProgress,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
