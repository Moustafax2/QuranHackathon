"use client";

import { useCallback, useEffect, useState } from "react";
import type { Database } from "@/lib/supabase/types";

type Player = Database["public"]["Tables"]["players"]["Row"];

interface AuthUser {
  sub: string;
  email: string | null;
  name: string | null;
  avatar: string | null;
}

interface AuthState {
  player: Player | null;
  user: AuthUser | null;
  isAuthenticated: boolean;
  loading: boolean;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

interface SessionResponse {
  isAuthenticated: boolean;
  user: AuthUser | null;
  player: Player | null;
}

export function useAuth(): AuthState {
  const [state, setState] = useState<Omit<AuthState, "logout" | "refresh">>({
    player: null,
    user: null,
    isAuthenticated: false,
    loading: true,
  });

  const loadSession = useCallback(async () => {
    try {
      const response = await fetch("/api/auth/qf/session", { cache: "no-store" });
      return (await response.json()) as SessionResponse;
    } catch {
      return {
        player: null,
        user: null,
        isAuthenticated: false,
      } satisfies SessionResponse;
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function hydrate() {
      const payload = await loadSession();
      if (cancelled) return;

      setState({
        player: payload.player,
        user: payload.user,
        isAuthenticated: payload.isAuthenticated,
        loading: false,
      });
    }

    void hydrate();

    return () => {
      cancelled = true;
    };
  }, [loadSession]);

  const refresh = useCallback(async () => {
    const payload = await loadSession();
    setState({
      player: payload.player,
      user: payload.user,
      isAuthenticated: payload.isAuthenticated,
      loading: false,
    });
  }, [loadSession]);

  const logout = useCallback(async () => {
    window.location.href = "/api/auth/qf/logout";
  }, []);

  return {
    ...state,
    logout,
    refresh,
  };
}
