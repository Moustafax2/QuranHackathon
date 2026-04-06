"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/lib/supabase/types";

type Player = Database["public"]["Tables"]["players"]["Row"];

interface AuthState {
  player: Player | null;
  loading: boolean;
}

/**
 * Placeholder auth hook.
 * Returns the current player from Supabase auth session.
 * Will be wired to quran.com OAuth by teammate.
 */
export function useAuth(): AuthState {
  const [state, setState] = useState<AuthState>({
    player: null,
    loading: true,
  });

  useEffect(() => {
    const supabase = createClient();

    async function getPlayer() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setState({ player: null, loading: false });
        return;
      }

      const { data: player } = await supabase
        .from("players")
        .select("*")
        .eq("id", user.id)
        .single();

      setState({ player: player ?? null, loading: false });
    }

    getPlayer();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      getPlayer();
    });

    return () => subscription.unsubscribe();
  }, []);

  return state;
}
