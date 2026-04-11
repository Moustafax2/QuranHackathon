import { createAdminClient, broadcastGameEvent } from "./supabase-admin.ts";

// 20s grace with ~8s client heartbeat allows brief disconnects without stalling rounds.
const HEARTBEAT_GRACE_SECONDS = 20;
const MILLISECONDS_PER_SECOND = 1000;

type AdminClient = ReturnType<typeof createAdminClient>;

export async function markParticipantHeartbeat(
  admin: AdminClient,
  gameId: string,
  playerId: string
) {
  await admin.from("game_participants").upsert({
    game_id: gameId,
    player_id: playerId,
    is_active: true,
    last_seen_at: new Date().toISOString(),
  });
}

export async function reconcileParticipants(
  admin: AdminClient,
  gameId: string,
  roomId: string
) {
  const { data: roomPlayers } = await admin
    .from("room_players")
    .select("player_id")
    .eq("room_id", roomId);

  if (!roomPlayers || roomPlayers.length === 0) return;

  const { data: existingParticipants } = await admin
    .from("game_participants")
    .select("player_id")
    .eq("game_id", gameId);

  const existingIds = new Set((existingParticipants ?? []).map((row) => row.player_id));
  const newParticipants = roomPlayers
    .filter((row) => !existingIds.has(row.player_id))
    .map((row) => ({
      game_id: gameId,
      player_id: row.player_id,
      is_active: true,
      last_seen_at: new Date().toISOString(),
    }));

  if (newParticipants.length === 0) return;
  await admin.from("game_participants").insert(newParticipants);
}

async function getEligibleParticipantIds(
  admin: AdminClient,
  gameId: string
): Promise<string[]> {
  const now = new Date();
  const thresholdIso = new Date(
    now.getTime() - HEARTBEAT_GRACE_SECONDS * MILLISECONDS_PER_SECOND
  ).toISOString();

  await admin
    .from("game_participants")
    .update({ is_active: false, became_inactive_at: now.toISOString() })
    .eq("game_id", gameId)
    .eq("is_active", true)
    .lt("last_seen_at", thresholdIso);

  const { data: eligibleRows } = await admin
    .from("game_participants")
    .select("player_id")
    .eq("game_id", gameId)
    .or(`is_active.eq.true,last_seen_at.gte.${thresholdIso}`);

  return (eligibleRows ?? []).map((row) => row.player_id);
}

export async function maybeCompleteRound(
  admin: AdminClient,
  gameId: string,
  roomId: string,
  roundId: string,
  roundNumber: number,
  correctVerseKey: string,
  correctText: string
): Promise<boolean> {
  await reconcileParticipants(admin, gameId, roomId);

  const eligiblePlayerIds = await getEligibleParticipantIds(admin, gameId);
  if (eligiblePlayerIds.length === 0) return false;

  const { count: totalAnswers } = await admin
    .from("round_answers")
    .select("*", { count: "exact", head: true })
    .eq("round_id", roundId)
    .in("player_id", eligiblePlayerIds);

  if ((totalAnswers ?? 0) < eligiblePlayerIds.length) {
    return false;
  }

  await endRound(
    admin,
    gameId,
    roundId,
    roundNumber,
    correctVerseKey,
    correctText
  );
  return true;
}

export async function endRound(
  admin: AdminClient,
  gameId: string,
  roundId: string,
  roundNumber: number,
  correctVerseKey: string,
  correctText: string
) {
  const { data: endedRows } = await admin
    .from("game_rounds")
    .update({ ended_at: new Date().toISOString() })
    .eq("id", roundId)
    .is("ended_at", null)
    .select("id");

  if (!endedRows || endedRows.length === 0) {
    return;
  }

  const { data: answers } = await admin
    .from("round_answers")
    .select("player_id, answer_verse_key, is_correct, points_awarded")
    .eq("round_id", roundId);

  const playerIds = (answers ?? []).map((a) => a.player_id);
  const { data: players } = await admin
    .from("players")
    .select("id, display_name")
    .in("id", playerIds);

  const nameMap = new Map(players?.map((p) => [p.id, p.display_name]) ?? []);

  const { data: game } = await admin
    .from("games")
    .select("room_id, total_rounds")
    .eq("id", gameId)
    .single();

  for (const answer of answers ?? []) {
    if (answer.points_awarded > 0) {
      await admin.rpc("increment_player_score", {
        p_room_id: game!.room_id,
        p_player_id: answer.player_id,
        p_delta: answer.points_awarded,
      });
    }
  }

  const { data: roomPlayers } = await admin
    .from("room_players")
    .select("player_id, score")
    .eq("room_id", game!.room_id);

  const scores: Record<string, number> = {};
  for (const rp of roomPlayers ?? []) {
    scores[rp.player_id] = rp.score;
  }

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

  if (roundNumber >= game!.total_rounds) {
    const winnerId = Object.entries(scores).sort(([, a], [, b]) => b - a)[0]?.[0];

    await admin
      .from("games")
      .update({ ended_at: new Date().toISOString(), winner_id: winnerId })
      .eq("id", gameId);

    await admin
      .from("rooms")
      .update({ status: "finished" })
      .eq("id", game!.room_id);

    for (const [pid, score] of Object.entries(scores)) {
      await admin.rpc("increment_player_stats", {
        p_player_id: pid,
        p_points: score,
        p_won: pid === winnerId,
      });
    }

    await broadcastGameEvent(gameId, {
      type: "game:end",
      payload: { scores, winner_id: winnerId },
    });
    return;
  }

  const { data: nextRound } = await admin
    .from("game_rounds")
    .select("*")
    .eq("game_id", gameId)
    .eq("round_number", roundNumber + 1)
    .single();

  if (!nextRound) return;

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
      options,
    },
  });
}
