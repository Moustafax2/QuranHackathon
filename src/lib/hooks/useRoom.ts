"use client";

import { useEffect, useState } from "react";
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
 * Tracks active room participants from the database so the lobby roster,
 * host controls, and game progression all agree on the same source of truth.
 */
export function useRoom(
  roomId: string | null,
  hostId: string | null
): UseRoomReturn {
  const [players, setPlayers] = useState<RoomPlayer[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!roomId) return;

    const supabase = createClient();
    const channel: RealtimeChannel = supabase.channel(`room-db:${roomId}`);
    let cancelled = false;

    async function fetchPlayers() {
      const response = await supabase
        .from("room_players")
        .select("player_id, joined_at, players!inner(display_name)")
        .eq("room_id", roomId)
        .eq("status", "active")
        .order("joined_at", { ascending: true });

      if (response.error) {
        if (cancelled) return;
        setError("Failed to load room players");
        return;
      }

      const nextPlayers = ((response.data ?? []) as Array<{
        player_id: string;
        players: { display_name: string } | { display_name: string }[];
      }>).map((row) => {
        const playerRecord = Array.isArray(row.players) ? row.players[0] : row.players;
        return {
          player_id: row.player_id,
          display_name: playerRecord?.display_name ?? "Unknown",
          is_host: row.player_id === hostId,
        };
      });

      if (cancelled) return;
      setError(null);
      setPlayers(nextPlayers);
    }

    void fetchPlayers();

    const interval = window.setInterval(() => {
      void fetchPlayers();
    }, 2000);

    channel
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "room_players",
          filter: `room_id=eq.${roomId}`,
        },
        () => {
          void fetchPlayers();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "rooms",
          filter: `id=eq.${roomId}`,
        },
        () => {
          void fetchPlayers();
        }
      )
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await fetchPlayers();
          setIsConnected(true);
        } else if (status === "CHANNEL_ERROR") {
          setError("Failed to connect to room");
          setIsConnected(false);
        }
      });

    return () => {
      cancelled = true;
      window.clearInterval(interval);
      void supabase.removeChannel(channel);
    };
  }, [hostId, roomId]);

  return { players, isConnected, error };
}
