import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  createAdminClient,
  corsHeaders,
} from "../_shared/supabase-admin.ts";

function generateRoomCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no I/O/0/1 to avoid confusion
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { player_id, game_mode, settings } = await req.json();

    if (!player_id || !game_mode) {
      return new Response(
        JSON.stringify({ error: "player_id and game_mode are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const admin = createAdminClient();

    // Generate unique room code (retry on collision)
    let code: string;
    let attempts = 0;
    do {
      code = generateRoomCode();
      const { data: existing } = await admin
        .from("rooms")
        .select("id")
        .eq("code", code)
        .single();
      if (!existing) break;
      attempts++;
    } while (attempts < 10);

    if (attempts >= 10) {
      return new Response(
        JSON.stringify({ error: "Failed to generate unique room code" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create room
    const { data: room, error: roomError } = await admin
      .from("rooms")
      .insert({
        code,
        host_id: player_id,
        game_mode,
        settings: settings ?? {
          num_rounds: 10,
          surah_filter: null,
          time_per_question: 30,
        },
      })
      .select()
      .single();

    if (roomError) {
      return new Response(
        JSON.stringify({ error: roomError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Add host as first player
    await admin.from("room_players").insert({
      room_id: room.id,
      player_id,
    });

    return new Response(
      JSON.stringify({ room_id: room.id, code: room.code }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
