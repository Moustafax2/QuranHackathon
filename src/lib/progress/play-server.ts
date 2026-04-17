import "server-only";

import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import type { Database } from "@/lib/supabase/types";
import type { PlayProgressEvent, PlayProgressResponse, VerseHotspot } from "@/lib/progress/types";
import { inferStoredRoundMode } from "@/lib/progress/utils";

type RoundAnswerRow = Database["public"]["Tables"]["round_answers"]["Row"];
type GameRoundRow = Database["public"]["Tables"]["game_rounds"]["Row"];
type PlayerRow = Database["public"]["Tables"]["players"]["Row"];
type VerseMistakeRow = Database["public"]["Tables"]["verse_mistakes"]["Row"];

const QURAN_API = "https://api.quran.com/api/v4";
const verseMetaCache = new Map<
  string,
  Promise<{ surahId: number | null; juzNumber: number | null; pageNumber: number | null }>
>();

async function fetchVerseMeta(verseKey: string) {
  if (verseMetaCache.has(verseKey)) {
    return verseMetaCache.get(verseKey)!;
  }

  const promise = (async () => {
    if (!verseKey || verseKey.startsWith("trivia-")) {
      return {
        surahId: null,
        juzNumber: null,
        pageNumber: null,
      };
    }

    const parsedSurahId = Number(verseKey.split(":")[0]);
    const surahId = Number.isFinite(parsedSurahId) ? parsedSurahId : null;

    try {
      const response = await fetch(
        `${QURAN_API}/verses/by_key/${verseKey}?language=en&fields=page_number,juz_number`,
        { cache: "force-cache" }
      );
      if (!response.ok) {
        return { surahId, juzNumber: null, pageNumber: null };
      }

      const payload = (await response.json()) as {
        verse?: { page_number?: number; juz_number?: number };
      };

      return {
        surahId,
        juzNumber: payload.verse?.juz_number ?? null,
        pageNumber: payload.verse?.page_number ?? null,
      };
    } catch {
      return { surahId, juzNumber: null, pageNumber: null };
    }
  })();

  verseMetaCache.set(verseKey, promise);
  return promise;
}

async function enrichRounds(rounds: GameRoundRow[]): Promise<Map<string, GameRoundRow>> {
  const supabase = createAdminSupabaseClient();
  const updates: Array<{
    id: string;
    game_mode: GameRoundRow["game_mode"];
    prompt_surah_id: number | null;
    prompt_juz_number: number | null;
    prompt_page_number: number | null;
  }> = [];

  const enrichedRounds = await Promise.all(
    rounds.map(async (round) => {
      const inferredMode = inferStoredRoundMode({
        promptVerseKey: round.prompt_verse_key,
        options: round.options,
        gameMode: round.game_mode,
      });

      const needsVerseMeta =
        inferredMode !== "trivia" &&
        (round.prompt_surah_id == null ||
          round.prompt_juz_number == null ||
          round.prompt_page_number == null);
      const verseMeta = needsVerseMeta
        ? await fetchVerseMeta(round.prompt_verse_key)
        : {
            surahId: round.prompt_surah_id,
            juzNumber: round.prompt_juz_number,
            pageNumber: round.prompt_page_number,
          };

      const nextRound: GameRoundRow = {
        ...round,
        game_mode: round.game_mode ?? inferredMode,
        prompt_surah_id: round.prompt_surah_id ?? verseMeta.surahId,
        prompt_juz_number: round.prompt_juz_number ?? verseMeta.juzNumber,
        prompt_page_number: round.prompt_page_number ?? verseMeta.pageNumber,
      };

      if (
        nextRound.game_mode !== round.game_mode ||
        nextRound.prompt_surah_id !== round.prompt_surah_id ||
        nextRound.prompt_juz_number !== round.prompt_juz_number ||
        nextRound.prompt_page_number !== round.prompt_page_number
      ) {
        updates.push({
          id: round.id,
          game_mode: nextRound.game_mode,
          prompt_surah_id: nextRound.prompt_surah_id,
          prompt_juz_number: nextRound.prompt_juz_number,
          prompt_page_number: nextRound.prompt_page_number,
        });
      }

      return nextRound;
    })
  );

  for (const update of updates) {
    await supabase
      .from("game_rounds")
      .update({
        game_mode: update.game_mode,
        prompt_surah_id: update.prompt_surah_id,
        prompt_juz_number: update.prompt_juz_number,
        prompt_page_number: update.prompt_page_number,
      })
      .eq("id", update.id);
  }

  return new Map(enrichedRounds.map((round) => [round.id, round]));
}

function normalizePlayEvents(
  answers: RoundAnswerRow[],
  roundsById: Map<string, GameRoundRow>
): PlayProgressEvent[] {
  const events: PlayProgressEvent[] = [];

  for (const answer of answers) {
    const round = roundsById.get(answer.round_id);
    if (!round) continue;

    events.push({
      id: answer.id,
      mode: round.game_mode ?? "multiple-choice",
      correct: answer.is_correct,
      points_awarded: answer.points_awarded,
      tested_at: answer.server_received_at,
      prompt_verse_key: round.prompt_verse_key,
      prompt_surah_id: round.prompt_surah_id,
      prompt_juz_number: round.prompt_juz_number,
      prompt_page_number: round.prompt_page_number,
    });
  }

  return events;
}

export async function getPlayerPlayProgress(playerId: string): Promise<PlayProgressResponse> {
  const supabase = createAdminSupabaseClient();

  const [{ data: player }, { data: answers }, { data: hotspots }] = await Promise.all([
    supabase
      .from("players")
      .select("id, display_name, total_points, total_wins, created_at")
      .eq("id", playerId)
      .maybeSingle(),
    supabase
      .from("round_answers")
      .select("*")
      .eq("player_id", playerId)
      .order("server_received_at", { ascending: true }),
    supabase
      .from("verse_mistakes")
      .select("*")
      .eq("player_id", playerId)
      .order("mistake_count", { ascending: false })
      .limit(10),
  ]);

  const roundIds = Array.from(new Set((answers ?? []).map((answer) => answer.round_id)));
  const rounds =
    roundIds.length > 0
      ? (
          await supabase
            .from("game_rounds")
            .select("*")
            .in("id", roundIds)
        ).data ?? []
      : [];

  const roundsById = await enrichRounds(rounds as GameRoundRow[]);

  return {
    player: (player as Pick<
      PlayerRow,
      "id" | "display_name" | "total_points" | "total_wins" | "created_at"
    > | null) ?? null,
    events: normalizePlayEvents((answers as RoundAnswerRow[] | null) ?? [], roundsById),
    hotspots: ((hotspots as VerseMistakeRow[] | null) ?? []).map((hotspot) => ({
      verse_key: hotspot.verse_key,
      mistake_count: hotspot.mistake_count,
      last_mistake_at: hotspot.last_mistake_at,
    })) as VerseHotspot[],
  };
}
