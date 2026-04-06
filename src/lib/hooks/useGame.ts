"use client";

import { useEffect, useReducer, useCallback, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import type { RealtimeChannel } from "@supabase/supabase-js";
import {
  INITIAL_GAME_STATE,
  reduceGameState,
  type GameEvent,
  type GameState,
} from "@/lib/game/state-machine";

interface UseGameReturn {
  gameState: GameState;
  submitAnswer: (roundId: string, answerVerseKey: string) => Promise<void>;
  pressBuzzer: (roundId: string) => Promise<void>;
}

/**
 * Manages Broadcast subscription for an active game.
 * Listens for game events and provides actions to submit answers / buzz.
 */
export function useGame(
  gameId: string | null,
  playerId: string | null
): UseGameReturn {
  const [gameState, dispatch] = useReducer(reduceGameState, INITIAL_GAME_STATE);
  const channelRef = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    if (!gameId) return;

    const supabase = createClient();
    const channel = supabase.channel(`game:${gameId}`);

    channel
      .on("broadcast", { event: "game_event" }, ({ payload }) => {
        const event = payload as GameEvent;
        dispatch(event);
      })
      .subscribe();

    channelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [gameId]);

  const submitAnswer = useCallback(
    async (roundId: string, answerVerseKey: string) => {
      if (!gameId || !playerId) return;

      const supabase = createClient();
      await supabase.functions.invoke("submit-answer", {
        body: {
          game_id: gameId,
          round_id: roundId,
          player_id: playerId,
          answer_verse_key: answerVerseKey,
        },
      });
    },
    [gameId, playerId]
  );

  const pressBuzzer = useCallback(
    async (roundId: string) => {
      if (!gameId || !playerId) return;

      const supabase = createClient();
      await supabase.functions.invoke("submit-answer", {
        body: {
          game_id: gameId,
          round_id: roundId,
          player_id: playerId,
          is_buzzer: true,
        },
      });
    },
    [gameId, playerId]
  );

  return { gameState, submitAnswer, pressBuzzer };
}
