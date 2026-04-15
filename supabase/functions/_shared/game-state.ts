import {
  createAdminClient,
  broadcastGameEvent,
} from "./supabase-admin.ts";

type AdminClient = ReturnType<typeof createAdminClient>;
const PARTICIPANT_STALE_MS = 15000;

interface ActiveRoomPlayer {
  player_id: string;
  score: number;
  joined_at: string;
}

interface RoundRow {
  id: string;
  round_number: number;
  correct_verse_key: string;
  correct_text: string | null;
  prompt_verse_key: string;
  prompt_text: string | null;
  options: unknown[] | null;
}

async function listActiveRoomPlayers(
  admin: AdminClient,
  roomId: string,
): Promise<ActiveRoomPlayer[]> {
  const { data, error } = await admin
    .from("room_players")
    .select("player_id, score, joined_at")
    .eq("room_id", roomId)
    .eq("status", "active")
    .order("joined_at", { ascending: true });

  if (error) {
    throw new Error(`Failed to load active room players: ${error.message}`);
  }

  return (data ?? []) as ActiveRoomPlayer[];
}

function getHeartbeatCutoffIso() {
  return new Date(Date.now() - PARTICIPANT_STALE_MS).toISOString();
}

async function listEligibleRoundParticipants(
  admin: AdminClient,
  roomId: string,
): Promise<ActiveRoomPlayer[]> {
  const { data, error } = await admin
    .from("room_players")
    .select("player_id, score, joined_at")
    .eq("room_id", roomId)
    .eq("status", "active")
    .gt("last_seen_at", getHeartbeatCutoffIso())
    .order("joined_at", { ascending: true });

  if (error) {
    throw new Error(`Failed to load eligible room players: ${error.message}`);
  }

  return (data ?? []) as ActiveRoomPlayer[];
}

function parseRoundOptions(options: unknown[] | null) {
  return (options ?? []).map((option) => {
    if (typeof option === "string") {
      try {
        return JSON.parse(option) as { verse_key: string; text: string };
      } catch {
        return { verse_key: "", text: option };
      }
    }

    return option as { verse_key: string; text: string };
  });
}

async function finishGame(
  admin: AdminClient,
  gameId: string,
  roomId: string,
  scores: Record<string, number>,
) {
  const winnerId =
    Object.entries(scores).sort(([, a], [, b]) => b - a)[0]?.[0] ?? null;
  const endedAt = new Date().toISOString();

  await admin
    .from("games")
    .update({ ended_at: endedAt, winner_id: winnerId })
    .eq("id", gameId);

  await admin
    .from("rooms")
    .update({ status: "finished" })
    .eq("id", roomId);

  for (const [playerId, score] of Object.entries(scores)) {
    await admin.rpc("increment_player_stats", {
      p_player_id: playerId,
      p_points: score,
      p_won: playerId === winnerId,
    });
  }

  await broadcastGameEvent(gameId, {
    type: "game:end",
    payload: { scores, winner_id: winnerId },
  });
}

export async function endRound(
  admin: AdminClient,
  gameId: string,
  roundId: string,
  roundNumber: number,
  correctVerseKey: string,
  correctText: string,
) {
  const { data: game, error: gameError } = await admin
    .from("games")
    .select("room_id, total_rounds")
    .eq("id", gameId)
    .single();

  if (gameError || !game) {
    throw new Error("Game not found while ending round.");
  }

  const activeRoomPlayers = await listActiveRoomPlayers(admin, game.room_id);
  const activePlayerIds = activeRoomPlayers.map((player) => player.player_id);

  let answersQuery = admin
    .from("round_answers")
    .select("player_id, answer_verse_key, is_correct, points_awarded")
    .eq("round_id", roundId);

  if (activePlayerIds.length > 0) {
    answersQuery = answersQuery.in("player_id", activePlayerIds);
  }

  const { data: answers, error: answersError } = await answersQuery;
  if (answersError) {
    throw new Error(`Failed to load round answers: ${answersError.message}`);
  }

  const { data: players, error: playersError } = activePlayerIds.length > 0
    ? await admin
        .from("players")
        .select("id, display_name")
        .in("id", activePlayerIds)
    : { data: [], error: null };

  if (playersError) {
    throw new Error(`Failed to load player names: ${playersError.message}`);
  }

  const nameMap = new Map((players ?? []).map((player) => [player.id, player.display_name]));

  for (const answer of answers ?? []) {
    if (answer.points_awarded > 0) {
      await admin.rpc("increment_player_score", {
        p_room_id: game.room_id,
        p_player_id: answer.player_id,
        p_delta: answer.points_awarded,
      });
    }
  }

  const { data: refreshedRoomPlayers, error: scoresError } = await admin
    .from("room_players")
    .select("player_id, score")
    .eq("room_id", game.room_id)
    .eq("status", "active");

  if (scoresError) {
    throw new Error(`Failed to load updated scores: ${scoresError.message}`);
  }

  const scores: Record<string, number> = {};
  for (const roomPlayer of refreshedRoomPlayers ?? []) {
    scores[roomPlayer.player_id] = roomPlayer.score;
  }

  await admin
    .from("game_rounds")
    .update({ ended_at: new Date().toISOString() })
    .eq("id", roundId);

  await broadcastGameEvent(gameId, {
    type: "round:end",
    payload: {
      correct_verse_key: correctVerseKey,
      correct_text: correctText,
      answers: (answers ?? []).map((answer) => ({
        player_id: answer.player_id,
        display_name: nameMap.get(answer.player_id) ?? "Unknown",
        answer_verse_key: answer.answer_verse_key,
        is_correct: answer.is_correct,
        points_awarded: answer.points_awarded,
      })),
      scores,
    },
  });

  if (roundNumber >= game.total_rounds) {
    await finishGame(admin, gameId, game.room_id, scores);
    return;
  }

  const { data: nextRound, error: nextRoundError } = await admin
    .from("game_rounds")
    .select("*")
    .eq("game_id", gameId)
    .eq("round_number", roundNumber + 1)
    .single();

  if (nextRoundError || !nextRound) {
    throw new Error("Next round not found.");
  }

  await admin
    .from("game_rounds")
    .update({ started_at: new Date().toISOString() })
    .eq("id", nextRound.id);

  const parsedNextRound = nextRound as RoundRow;

  await broadcastGameEvent(gameId, {
    type: "round:start",
    payload: {
      round_id: parsedNextRound.id,
      round_number: parsedNextRound.round_number,
      total_rounds: game.total_rounds,
      prompt_verse_key: parsedNextRound.prompt_verse_key,
      prompt_text: parsedNextRound.prompt_text ?? "",
      options: parseRoundOptions(parsedNextRound.options),
    },
  });
}

export async function maybeAdvanceGameAfterParticipantChange(
  admin: AdminClient,
  gameId: string,
) {
  const { data: game, error: gameError } = await admin
    .from("games")
    .select("id, room_id, ended_at")
    .eq("id", gameId)
    .maybeSingle();

  if (gameError) {
    throw new Error(`Failed to load game: ${gameError.message}`);
  }

  if (!game || game.ended_at) {
    return;
  }

  const { data: round, error: roundError } = await admin
    .from("game_rounds")
    .select("id, round_number, correct_verse_key, correct_text")
    .eq("game_id", gameId)
    .is("ended_at", null)
    .order("round_number", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (roundError) {
    throw new Error(`Failed to load current round: ${roundError.message}`);
  }

  if (!round) {
    return;
  }

  const activePlayers = await listEligibleRoundParticipants(admin, game.room_id);
  if (activePlayers.length === 0) {
    await finishGame(admin, gameId, game.room_id, {});
    return;
  }

  const { count: totalAnswers, error: answersError } = await admin
    .from("round_answers")
    .select("*", { count: "exact", head: true })
    .eq("round_id", round.id)
    .in("player_id", activePlayers.map((player) => player.player_id));

  if (answersError) {
    throw new Error(`Failed to count round answers: ${answersError.message}`);
  }

  if ((totalAnswers ?? 0) >= activePlayers.length) {
    await endRound(
      admin,
      gameId,
      round.id,
      round.round_number,
      round.correct_verse_key,
      round.correct_text ?? "",
    );
  }
}

export async function reassignHostIfNeeded(
  admin: AdminClient,
  roomId: string,
  departingPlayerId: string,
) {
  const { data: room, error: roomError } = await admin
    .from("rooms")
    .select("host_id")
    .eq("id", roomId)
    .single();

  if (roomError || !room) {
    throw new Error("Room not found while reassigning host.");
  }

  const activePlayers = await listActiveRoomPlayers(admin, roomId);

  if (activePlayers.length === 0) {
    await admin
      .from("rooms")
      .update({ status: "finished" })
      .eq("id", roomId);
    return;
  }

  if (room.host_id !== departingPlayerId) {
    return;
  }

  const nextHostId = activePlayers[0]?.player_id;
  if (!nextHostId) {
    return;
  }

  await admin
    .from("rooms")
    .update({ host_id: nextHostId })
    .eq("id", roomId);
}
