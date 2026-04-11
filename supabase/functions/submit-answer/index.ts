import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  createAdminClient,
  broadcastGameEvent,
  corsHeaders,
} from "../_shared/supabase-admin.ts";
import {
  markParticipantHeartbeat,
  maybeCompleteRound,
} from "../_shared/game-participants.ts";

const BASE_POINTS = 10;
const SPEED_BONUS = 5;

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { game_id, round_id, player_id, answer_verse_key, is_buzzer } =
      await req.json();

    if (!game_id || !round_id || !player_id) {
      return new Response(
        JSON.stringify({ error: "game_id, round_id, and player_id are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const admin = createAdminClient();
    const serverReceivedAt = new Date().toISOString();

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

    await markParticipantHeartbeat(admin, game_id, player_id);

    // Get the round
    const { data: round, error: roundError } = await admin
      .from("game_rounds")
      .select("*")
      .eq("id", round_id)
      .single();

    if (roundError || !round) {
      return new Response(
        JSON.stringify({ error: "Round not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if player already answered this round
    const { data: existingAnswer } = await admin
      .from("round_answers")
      .select("id")
      .eq("round_id", round_id)
      .eq("player_id", player_id)
      .single();

    if (existingAnswer) {
      return new Response(
        JSON.stringify({ error: "Already answered this round" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get player display name
    const { data: player } = await admin
      .from("players")
      .select("display_name")
      .eq("id", player_id)
      .single();

    const displayName = player?.display_name ?? "Unknown";

    if (is_buzzer) {
      // Buzzer mode: check if someone already buzzed for this round
      const { data: existingBuzzes } = await admin
        .from("round_answers")
        .select("id")
        .eq("round_id", round_id)
        .order("server_received_at", { ascending: true })
        .limit(1);

      if (existingBuzzes && existingBuzzes.length > 0) {
        // Someone already buzzed first
        return new Response(
          JSON.stringify({ error: "Someone else buzzed first" }),
          { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // This player buzzed first — record it (correctness determined later by host)
      await admin.from("round_answers").insert({
        round_id,
        player_id,
        is_correct: false, // updated when host confirms
        server_received_at: serverReceivedAt,
        points_awarded: 0,
      });

      // Broadcast buzzer winner
      await broadcastGameEvent(game_id, {
        type: "buzzer:winner",
        payload: { player_id, display_name: displayName },
      });

      return new Response(
        JSON.stringify({ buzzer_winner: true }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Multiple choice mode
    const isCorrect = answer_verse_key === round.correct_verse_key;

    // Calculate points: count how many already answered to determine speed bonus
    const { count: answeredCount } = await admin
      .from("round_answers")
      .select("*", { count: "exact", head: true })
      .eq("round_id", round_id);

    const points = isCorrect
      ? BASE_POINTS + Math.max(0, SPEED_BONUS - (answeredCount ?? 0))
      : 0;

    // Insert answer
    await admin.from("round_answers").insert({
      round_id,
      player_id,
      answer_verse_key,
      is_correct: isCorrect,
      server_received_at: serverReceivedAt,
      points_awarded: points,
    });

    // Track mistake if wrong
    if (!isCorrect) {
      const { data: existing } = await admin
        .from("verse_mistakes")
        .select("mistake_count")
        .eq("player_id", player_id)
        .eq("verse_key", round.correct_verse_key)
        .single();

      if (existing) {
        await admin
          .from("verse_mistakes")
          .update({
            mistake_count: existing.mistake_count + 1,
            last_mistake_at: serverReceivedAt,
          })
          .eq("player_id", player_id)
          .eq("verse_key", round.correct_verse_key);
      } else {
        await admin.from("verse_mistakes").insert({
          player_id,
          verse_key: round.correct_verse_key,
        });
      }
    }

    // Broadcast individual result
    await broadcastGameEvent(game_id, {
      type: "answer:result",
      payload: {
        player_id,
        display_name: displayName,
        answer_verse_key,
        is_correct: isCorrect,
        points_awarded: points,
      },
    });

    await maybeCompleteRound(
      admin,
      game_id,
      game.room_id,
      round_id,
      round.round_number,
      round.correct_verse_key,
      round.correct_text ?? ""
    );

    return new Response(
      JSON.stringify({ is_correct: isCorrect, points_awarded: points }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
