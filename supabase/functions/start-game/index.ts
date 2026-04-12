import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  createAdminClient,
  broadcastGameEvent,
  corsHeaders,
} from "../_shared/supabase-admin.ts";

interface Question {
  prompt_verse_key: string;
  prompt_text: string;
  correct_verse_key: string;
  correct_text: string;
  options: { verse_key: string; text: string }[];
  game_mode?: string;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { room_id, player_id, questions } = await req.json() as {
      room_id: string;
      player_id: string;
      questions: Question[];
    };

    if (!room_id || !player_id) {
      return new Response(
        JSON.stringify({ error: "room_id and player_id are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!Array.isArray(questions) || questions.length === 0) {
      return new Response(
        JSON.stringify({ error: "questions array is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const admin = createAdminClient();

    // Verify room exists and player is host
    const { data: room, error: roomError } = await admin
      .from("rooms")
      .select("id, host_id, status")
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

    const { count: activePlayers, error: activePlayersError } = await admin
      .from("room_players")
      .select("*", { count: "exact", head: true })
      .eq("room_id", room_id)
      .eq("status", "active");

    if (activePlayersError) {
      return new Response(
        JSON.stringify({ error: "Failed to load room participants" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if ((activePlayers ?? 0) === 0) {
      return new Response(
        JSON.stringify({ error: "No active players remain in this room" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create game record
    const { data: game, error: gameError } = await admin
      .from("games")
      .insert({ room_id, total_rounds: questions.length })
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

    // Update room status and reset scores
    await admin.from("rooms").update({ status: "in_progress" }).eq("id", room_id);
    await admin
      .from("room_players")
      .update({ score: 0 })
      .eq("room_id", room_id)
      .eq("status", "active");
    await admin
      .from("game_rounds")
      .update({ started_at: new Date().toISOString() })
      .eq("id", insertedRounds![0].id);

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
