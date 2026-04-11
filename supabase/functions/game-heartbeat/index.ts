import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  createAdminClient,
  corsHeaders,
} from "../_shared/supabase-admin.ts";
import {
  markParticipantHeartbeat,
  maybeCompleteRound,
} from "../_shared/game-participants.ts";

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { game_id, player_id } = await req.json();

    if (!game_id || !player_id) {
      return new Response(
        JSON.stringify({ error: "game_id and player_id are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const admin = createAdminClient();
    const { data: game } = await admin
      .from("games")
      .select("room_id")
      .eq("id", game_id)
      .single();

    if (!game) {
      return new Response(
        JSON.stringify({ error: "Game not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: roomMembership } = await admin
      .from("room_players")
      .select("player_id")
      .eq("room_id", game.room_id)
      .eq("player_id", player_id)
      .maybeSingle();

    if (!roomMembership) {
      return new Response(
        JSON.stringify({ error: "Player is not part of this game" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    await markParticipantHeartbeat(admin, game_id, player_id);

    const { data: currentRound } = await admin
      .from("game_rounds")
      .select("id, round_number, correct_verse_key, correct_text")
      .eq("game_id", game_id)
      .is("ended_at", null)
      .order("round_number", { ascending: true })
      .limit(1)
      .maybeSingle();

    let roundCompleted = false;
    if (currentRound) {
      roundCompleted = await maybeCompleteRound(
        admin,
        game_id,
        game.room_id,
        currentRound.id,
        currentRound.round_number,
        currentRound.correct_verse_key,
        currentRound.correct_text ?? ""
      );
    }

    return new Response(
      JSON.stringify({ ok: true, round_completed: roundCompleted }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
