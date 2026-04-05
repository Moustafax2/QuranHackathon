import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  createAdminClient,
  broadcastGameEvent,
  corsHeaders,
} from "../_shared/supabase-admin.ts";
import { generateQuestions } from "../_shared/question-generator.ts";

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { room_id, player_id } = await req.json();

    if (!room_id || !player_id) {
      return new Response(
        JSON.stringify({ error: "room_id and player_id are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const admin = createAdminClient();

    // Verify room exists and player is host
    const { data: room, error: roomError } = await admin
      .from("rooms")
      .select("*")
      .eq("id", room_id)
      .single();

    if (roomError || !room) {
      return new Response(
        JSON.stringify({ error: "Room not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (room.host_id !== player_id) {
      return new Response(
        JSON.stringify({ error: "Only the host can start the game" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (room.status !== "lobby") {
      return new Response(
        JSON.stringify({ error: "Game already started" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const settings = room.settings as {
      num_rounds: number;
      surah_filter: number[] | null;
      time_per_question: number;
    };

    // Generate all questions upfront
    const questions = await generateQuestions(
      settings.num_rounds,
      room.game_mode,
      settings.surah_filter
    );

    if (questions.length === 0) {
      return new Response(
        JSON.stringify({ error: "Failed to generate questions" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create game record
    const { data: game, error: gameError } = await admin
      .from("games")
      .insert({
        room_id,
        total_rounds: questions.length,
      })
      .select()
      .single();

    if (gameError || !game) {
      return new Response(
        JSON.stringify({ error: "Failed to create game" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Insert all rounds
    const rounds = questions.map((q, i) => ({
      game_id: game.id,
      round_number: i + 1,
      prompt_verse_key: q.prompt_verse_key,
      correct_verse_key: q.correct_verse_key,
      prompt_text: q.prompt_text,
      correct_text: q.correct_text,
      options: q.options.length > 0
        ? q.options.map((o) => JSON.stringify(o))
        : null,
    }));

    const { data: insertedRounds, error: roundsError } = await admin
      .from("game_rounds")
      .insert(rounds)
      .select();

    if (roundsError) {
      return new Response(
        JSON.stringify({ error: "Failed to create rounds" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Update room status
    await admin
      .from("rooms")
      .update({ status: "in_progress" })
      .eq("id", room_id);

    // Reset room_players scores
    await admin
      .from("room_players")
      .update({ score: 0 })
      .eq("room_id", room_id);

    // Broadcast first round
    const firstRound = insertedRounds![0];
    const firstQuestion = questions[0];

    await broadcastGameEvent(game.id, {
      type: "round:start",
      payload: {
        round_id: firstRound.id,
        round_number: 1,
        total_rounds: questions.length,
        prompt_verse_key: firstQuestion.prompt_verse_key,
        prompt_text: firstQuestion.prompt_text,
        correct_verse_key: firstQuestion.correct_verse_key,
        options: firstQuestion.options,
      },
    });

    return new Response(
      JSON.stringify({ game_id: game.id, total_rounds: questions.length }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
