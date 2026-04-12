import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  createAdminClient,
  broadcastGameEvent,
  corsHeaders,
} from "../_shared/supabase-admin.ts";
import { endRound } from "../_shared/game-state.ts";

const BASE_POINTS = 5;
const SPEED_BONUSES = [3, 2, 1]; // 1st, 2nd, 3rd correct answerer

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
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const admin = createAdminClient();
    const serverReceivedAt = new Date().toISOString();

    const { data: game, error: gameError } = await admin
      .from("games")
      .select("room_id, ended_at")
      .eq("id", game_id)
      .single();

    if (gameError || !game) {
      return new Response(
        JSON.stringify({ error: "Game not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (game.ended_at) {
      return new Response(
        JSON.stringify({ error: "Game has already ended" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { data: participant, error: participantError } = await admin
      .from("room_players")
      .select("player_id")
      .eq("room_id", game.room_id)
      .eq("player_id", player_id)
      .eq("status", "active")
      .maybeSingle();

    if (participantError || !participant) {
      return new Response(
        JSON.stringify({ error: "You are no longer an active participant in this game" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    await admin
      .from("room_players")
      .update({ last_seen_at: serverReceivedAt })
      .eq("room_id", game.room_id)
      .eq("player_id", player_id)
      .eq("status", "active");

    const { data: round, error: roundError } = await admin
      .from("game_rounds")
      .select("*")
      .eq("id", round_id)
      .eq("game_id", game_id)
      .single();

    if (roundError || !round) {
      return new Response(
        JSON.stringify({ error: "Round not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { data: existingAnswer } = await admin
      .from("round_answers")
      .select("id")
      .eq("round_id", round_id)
      .eq("player_id", player_id)
      .maybeSingle();

    if (existingAnswer) {
      return new Response(
        JSON.stringify({ error: "Already answered this round" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { data: player } = await admin
      .from("players")
      .select("display_name")
      .eq("id", player_id)
      .single();

    const displayName = player?.display_name ?? "Unknown";

    if (is_buzzer) {
      const { data: existingBuzzes } = await admin
        .from("round_answers")
        .select("id")
        .eq("round_id", round_id)
        .order("server_received_at", { ascending: true })
        .limit(1);

      if (existingBuzzes && existingBuzzes.length > 0) {
        return new Response(
          JSON.stringify({ error: "Someone else buzzed first" }),
          { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      await admin.from("round_answers").insert({
        round_id,
        player_id,
        is_correct: false,
        server_received_at: serverReceivedAt,
        points_awarded: 0,
      });

      await broadcastGameEvent(game_id, {
        type: "buzzer:winner",
        payload: { player_id, display_name: displayName },
      });

      return new Response(
        JSON.stringify({ buzzer_winner: true }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const isCorrect = answer_verse_key === round.correct_verse_key;

    // Calculate points: count how many have already answered CORRECTLY to determine speed bonus
    const { count: correctCount } = await admin
      .from("round_answers")
      .select("*", { count: "exact", head: true })
      .eq("round_id", round_id)
      .eq("is_correct", true);

    const speedBonus = SPEED_BONUSES[correctCount ?? 0] ?? 0;
    const points = isCorrect ? BASE_POINTS + speedBonus : 0;

    await admin.from("round_answers").insert({
      round_id,
      player_id,
      answer_verse_key,
      is_correct: isCorrect,
      server_received_at: serverReceivedAt,
      points_awarded: points,
    });

    if (!isCorrect) {
      const { data: existing } = await admin
        .from("verse_mistakes")
        .select("mistake_count")
        .eq("player_id", player_id)
        .eq("verse_key", round.correct_verse_key)
        .maybeSingle();

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

    const heartbeatCutoff = new Date(Date.now() - 15000).toISOString();
    const { data: activeParticipants, error: activeParticipantsError } = await admin
      .from("room_players")
      .select("player_id")
      .eq("room_id", game.room_id)
      .eq("status", "active")
      .gt("last_seen_at", heartbeatCutoff);

    if (activeParticipantsError) {
      return new Response(
        JSON.stringify({ error: "Failed to load active participants" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const activePlayerIds = (activeParticipants ?? []).map((row) => row.player_id);
    const totalPlayers = activePlayerIds.length;
    let answerCountQuery = admin
      .from("round_answers")
      .select("*", { count: "exact", head: true })
      .eq("round_id", round_id);

    if (activePlayerIds.length > 0) {
      answerCountQuery = answerCountQuery.in("player_id", activePlayerIds);
    }

    const { count: totalAnswers } = await answerCountQuery;

    if ((totalAnswers ?? 0) >= (totalPlayers ?? 0)) {
      await endRound(
        admin,
        game_id,
        round_id,
        round.round_number,
        round.correct_verse_key,
        round.correct_text ?? "",
      );
    }

    return new Response(
      JSON.stringify({ is_correct: isCorrect, points_awarded: points }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
