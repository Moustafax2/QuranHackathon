"use client";

import { useEffect, useReducer, useCallback, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/lib/supabase/types";
import type { RealtimeChannel } from "@supabase/supabase-js";
import {
  INITIAL_GAME_STATE,
  reduceGameState,
  type GameEvent,
  type GameState,
} from "@/lib/game/state-machine";

type GameRow = Database["public"]["Tables"]["games"]["Row"];
type GameRoundRow = Database["public"]["Tables"]["game_rounds"]["Row"];
type RoomPlayerRow = Database["public"]["Tables"]["room_players"]["Row"];

interface SubmitResult { ok: boolean; error?: string }

interface UseGameReturn {
  gameState: GameState;
  submitAnswer: (roundId: string, answerVerseKey: string) => Promise<SubmitResult>;
  pressBuzzer: (roundId: string) => Promise<SubmitResult>;
}

/**
 * Manages Broadcast subscription for an active game.
 * Listens for game events and provides actions to submit answers / buzz.
 */
export function useGame(
  gameId: string | null,
  playerId: string | null,
  guestPlayerId?: string | null
): UseGameReturn {
  const [gameState, dispatch] = useReducer(reduceGameState, INITIAL_GAME_STATE);
  const channelRef = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    if (!gameId) return;
    const currentGameId = gameId;

    const supabase = createClient();
    const channel = supabase.channel(`game:${currentGameId}`, {
      config: {
        broadcast: {
          self: false,
        },
      },
    });
    let cancelled = false;

    async function hydrateCurrentRound() {
      const gameResponse = await supabase
        .from("games")
        .select("id, room_id, total_rounds, winner_id, ended_at")
        .eq("id", currentGameId)
        .single();
      const game = gameResponse.data as Pick<
        GameRow,
        "id" | "room_id" | "total_rounds" | "winner_id" | "ended_at"
      > | null;

      if (!game || cancelled) return;

      if (game.ended_at) {
        const roomPlayersResponse = await supabase
          .from("room_players")
          .select("player_id, score")
          .eq("room_id", game.room_id)
          .eq("status", "active");
        const roomPlayers = roomPlayersResponse.data as Pick<
          RoomPlayerRow,
          "player_id" | "score"
        >[] | null;

        const scores = Object.fromEntries(
          (roomPlayers ?? []).map((row) => [row.player_id, row.score])
        );

        dispatch({
          type: "game:end",
          payload: {
            scores,
            winner_id: game.winner_id,
          },
        });
        return;
      }

      const roundsResponse = await supabase
        .from("game_rounds")
        .select("*")
        .eq("game_id", currentGameId)
        .order("round_number", { ascending: true });
      const rounds = roundsResponse.data as GameRoundRow[] | null;

      if (!rounds || cancelled) return;

      const currentRound =
        rounds.find((round) => !round.ended_at) ??
        rounds[0];

      if (!currentRound) return;

      const options = (currentRound.options ?? []).map((option) => {
        if (typeof option === "string") {
          try {
            return JSON.parse(option) as { verse_key: string; text: string };
          } catch {
            return { verse_key: "", text: option };
          }
        }

        return option as unknown as { verse_key: string; text: string };
      });

      dispatch({
        type: "round:start",
        payload: {
          round_id: currentRound.id,
          round_number: currentRound.round_number,
          total_rounds: game.total_rounds,
          prompt_verse_key: currentRound.prompt_verse_key,
          prompt_text: currentRound.prompt_text ?? "",
          options,
        },
      });
    }

    channel
      .on("broadcast", { event: "game_event" }, ({ payload }) => {
        const event = payload as GameEvent;
        dispatch(event);

        // The server can end one round and immediately broadcast the next.
        // Re-hydrate after round end so clients recover even if that next
        // round:start broadcast is missed locally.
        if (event.type === "round:end") {
          window.setTimeout(() => {
            void hydrateCurrentRound();
          }, 250);
        }
      })
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          void hydrateCurrentRound();
        }
      });

    channelRef.current = channel;

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [gameId]);

  const buildHeaders = useCallback(() => {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (guestPlayerId) headers["X-Guest-Player-Id"] = guestPlayerId;
    return headers;
  }, [guestPlayerId]);

  const submitAnswer = useCallback(
    async (roundId: string, answerVerseKey: string): Promise<{ ok: boolean; error?: string }> => {
      if (!gameId || !playerId) return { ok: false };
      try {
        const res = await fetch("/api/multiplayer/submit-answer", {
          method: "POST",
          headers: buildHeaders(),
          body: JSON.stringify({
            game_id: gameId,
            round_id: roundId,
            answer_verse_key: answerVerseKey,
          }),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          return { ok: false, error: body.error ?? "Failed to submit answer" };
        }
        return { ok: true };
      } catch {
        return { ok: false, error: "Network error — answer may not have been recorded" };
      }
    },
    [gameId, playerId, buildHeaders]
  );

  const pressBuzzer = useCallback(
    async (roundId: string): Promise<{ ok: boolean; error?: string }> => {
      if (!gameId || !playerId) return { ok: false };
      try {
        const res = await fetch("/api/multiplayer/submit-answer", {
          method: "POST",
          headers: buildHeaders(),
          body: JSON.stringify({
            game_id: gameId,
            round_id: roundId,
            is_buzzer: true,
          }),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          return { ok: false, error: body.error ?? "Failed to buzz" };
        }
        return { ok: true };
      } catch {
        return { ok: false, error: "Network error — buzz may not have been recorded" };
      }
    },
    [gameId, playerId, buildHeaders]
  );

  return { gameState, submitAnswer, pressBuzzer };
}
