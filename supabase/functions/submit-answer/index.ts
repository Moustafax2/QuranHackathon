import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  createAdminClient,
  broadcastGameEvent,
  corsHeaders,
} from "../_shared/supabase-admin.ts";

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

    // Check if all players have answered
    const { data: game } = await admin
      .from("games")
      .select("room_id")
      .eq("id", game_id)
      .single();

    const { count: totalPlayers } = await admin
      .from("room_players")
      .select("*", { count: "exact", head: true })
      .eq("room_id", game!.room_id);

    const { count: totalAnswers } = await admin
      .from("round_answers")
      .select("*", { count: "exact", head: true })
      .eq("round_id", round_id);

    if ((totalAnswers ?? 0) >= (totalPlayers ?? 0)) {
      // All players answered — end the round
      await endRound(admin, game_id, round_id, round.round_number, round.correct_verse_key, round.correct_text ?? "");
    }

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

async function endRound(
  admin: ReturnType<typeof createAdminClient>,
  gameId: string,
  roundId: string,
  roundNumber: number,
  correctVerseKey: string,
  correctText: string
) {
  // Get all answers for this round
  const { data: answers } = await admin
    .from("round_answers")
    .select("player_id, answer_verse_key, is_correct, points_awarded")
    .eq("round_id", roundId);

  // Get player names
  const playerIds = (answers ?? []).map((a) => a.player_id);
  const { data: players } = await admin
    .from("players")
    .select("id, display_name")
    .in("id", playerIds);

  const nameMap = new Map(players?.map((p) => [p.id, p.display_name]) ?? []);

  // Update room_players scores
  const { data: game } = await admin
    .from("games")
    .select("room_id, total_rounds")
    .eq("id", gameId)
    .single();

  for (const answer of answers ?? []) {
    if (answer.points_awarded > 0) {
      // Increment score
      const { data: rp } = await admin
        .from("room_players")
        .select("score")
        .eq("room_id", game!.room_id)
        .eq("player_id", answer.player_id)
        .single();

      await admin
        .from("room_players")
        .update({ score: (rp?.score ?? 0) + answer.points_awarded })
        .eq("room_id", game!.room_id)
        .eq("player_id", answer.player_id);
    }
  }

  // Get current scores
  const { data: roomPlayers } = await admin
    .from("room_players")
    .select("player_id, score")
    .eq("room_id", game!.room_id);

  const scores: Record<string, number> = {};
  for (const rp of roomPlayers ?? []) {
    scores[rp.player_id] = rp.score;
  }

  // Mark round as ended
  await admin
    .from("game_rounds")
    .update({ ended_at: new Date().toISOString() })
    .eq("id", roundId);

  // Broadcast round end
  await broadcastGameEvent(gameId, {
    type: "round:end",
    payload: {
      correct_verse_key: correctVerseKey,
      correct_text: correctText,
      answers: (answers ?? []).map((a) => ({
        player_id: a.player_id,
        display_name: nameMap.get(a.player_id) ?? "Unknown",
        answer_verse_key: a.answer_verse_key,
        is_correct: a.is_correct,
        points_awarded: a.points_awarded,
      })),
      scores,
    },
  });

  // Check if this was the last round
  if (roundNumber >= game!.total_rounds) {
    // Game over — find winner
    const winnerId = Object.entries(scores).sort(
      ([, a], [, b]) => b - a
    )[0]?.[0];

    await admin
      .from("games")
      .update({ ended_at: new Date().toISOString(), winner_id: winnerId })
      .eq("id", gameId);

    await admin
      .from("rooms")
      .update({ status: "finished" })
      .eq("id", game!.room_id);

    // Update player lifetime stats
    for (const [pid, score] of Object.entries(scores)) {
      const { data: p } = await admin
        .from("players")
        .select("total_points, total_wins")
        .eq("id", pid)
        .single();

      await admin
        .from("players")
        .update({
          total_points: (p?.total_points ?? 0) + score,
          total_wins: (p?.total_wins ?? 0) + (pid === winnerId ? 1 : 0),
        })
        .eq("id", pid);
    }

    await broadcastGameEvent(gameId, {
      type: "game:end",
      payload: { scores, winner_id: winnerId },
    });
  } else {
    // Start next round
    const { data: nextRound } = await admin
      .from("game_rounds")
      .select("*")
      .eq("game_id", gameId)
      .eq("round_number", roundNumber + 1)
      .single();

    if (nextRound) {
      // Parse options back from stored format
      let options: { verse_key: string; text: string }[] = [];
      if (nextRound.options) {
        options = (nextRound.options as string[]).map((o: string) => {
          try {
            return JSON.parse(o);
          } catch {
            return { verse_key: "", text: o };
          }
        });
      }

      await admin
        .from("game_rounds")
        .update({ started_at: new Date().toISOString() })
        .eq("id", nextRound.id);

      await broadcastGameEvent(gameId, {
        type: "round:start",
        payload: {
          round_id: nextRound.id,
          round_number: nextRound.round_number,
          total_rounds: game!.total_rounds,
          prompt_verse_key: nextRound.prompt_verse_key,
          prompt_text: nextRound.prompt_text ?? "",
          correct_verse_key: nextRound.correct_verse_key,
          options,
        },
      });
    }
  }
}
