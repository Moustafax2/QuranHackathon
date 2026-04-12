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

    if (room.status !== "lobby") {
      return new Response(
        JSON.stringify({ error: "Game already in progress" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check player count
    const { count } = await admin
      .from("room_players")
      .select("*", { count: "exact", head: true })
      .eq("room_id", room.id)
      .eq("status", "active");

    if ((count ?? 0) >= 8) {
      return new Response(
        JSON.stringify({ error: "Room is full (max 8 players)" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if already in room
    const { data: existing } = await admin
      .from("room_players")
      .select("player_id, status")
      .eq("room_id", room.id)
      .eq("player_id", player_id)
      .maybeSingle();

    if (existing?.status === "left") {
      return new Response(
        JSON.stringify({ error: "You already left this game and cannot rejoin it." }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!existing) {
      // Add player to room
      const { error: joinError } = await admin
        .from("room_players")
        .insert({
          room_id: room.id,
          player_id,
          status: "active",
          left_at: null,
          last_seen_at: new Date().toISOString(),
        });

      if (joinError) {
        return new Response(
          JSON.stringify({ error: joinError.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }
    else {
      await admin
        .from("room_players")
        .update({ last_seen_at: new Date().toISOString() })
        .eq("room_id", room.id)
        .eq("player_id", player_id)
        .eq("status", "active");
    }

    return new Response(
      JSON.stringify({
        room_id: room.id,
        code: room.code,
        host_id: room.host_id,
        game_mode: room.game_mode,
        settings: room.settings,
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
