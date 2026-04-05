"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import type { RealtimeChannel } from "@supabase/supabase-js";

export interface RoomPlayer {
  player_id: string;
  display_name: string;
  is_host: boolean;
}

interface UseRoomReturn {
  players: RoomPlayer[];
  isConnected: boolean;
  error: string | null;
}

/**
 * Manages Presence subscription for a game room lobby.
 * Tracks which players are currently in the room in real-time.
 */
export function useRoom(
  roomCode: string,
  currentPlayer: { id: string; display_name: string } | null,
  hostId: string | null
): UseRoomReturn {
  const [players, setPlayers] = useState<RoomPlayer[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!currentPlayer || !roomCode) return;

    const supabase = createClient();
    const channel: RealtimeChannel = supabase.channel(`room:${roomCode}`, {
      config: { presence: { key: currentPlayer.id } },
    });

    channel
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState<{
          player_id: string;
          display_name: string;
        }>();

        const presentPlayers: RoomPlayer[] = Object.entries(state).map(
          ([key, presences]) => ({
            player_id: key,
            display_name: presences[0]?.display_name ?? "Unknown",
            is_host: key === hostId,
          })
        );

        setPlayers(presentPlayers);
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channel.track({
            player_id: currentPlayer.id,
            display_name: currentPlayer.display_name,
          });
          setIsConnected(true);
        } else if (status === "CHANNEL_ERROR") {
          setError("Failed to connect to room");
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomCode, currentPlayer?.id, currentPlayer?.display_name, hostId]);

  return { players, isConnected, error };
}
