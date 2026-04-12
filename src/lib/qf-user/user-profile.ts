import "server-only";

import type { Database } from "@/lib/supabase/types";
import { getSupabaseAdminConfig as getResolvedSupabaseAdminConfig } from "@/lib/supabase/env";
import type { QfUserProfile } from "./types";

type PlayerRow = Database["public"]["Tables"]["players"]["Row"];
type PlayerInsert = Database["public"]["Tables"]["players"]["Insert"];
type PlayerUpdate = Database["public"]["Tables"]["players"]["Update"];

function getSupabaseAdminConfig() {
  return getResolvedSupabaseAdminConfig();
}

async function supabaseRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const { url, serviceRoleKey } = getSupabaseAdminConfig();
  const response = await fetch(`${url}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
      ...init?.headers,
    },
    cache: "no-store",
  });

  const payload = (await response.json().catch(() => null)) as T | { message?: string } | null;

  if (!response.ok) {
    const message =
      payload && typeof payload === "object" && "message" in payload
        ? payload.message
        : `Supabase REST request failed (${response.status}).`;
    throw new Error(message);
  }

  return payload as T;
}

export async function getPlayerById(playerId: string): Promise<PlayerRow | null> {
  const players = await supabaseRequest<PlayerRow[]>(
    `players?select=*&id=eq.${encodeURIComponent(playerId)}`
  );
  return players[0] ?? null;
}

export async function getPlayerByQfSub(qfSub: string): Promise<PlayerRow | null> {
  const players = await supabaseRequest<PlayerRow[]>(
    `players?select=*&quran_foundation_uid=eq.${encodeURIComponent(qfSub)}`
  );
  return players[0] ?? null;
}

export async function listPlayersForDevAuth(): Promise<PlayerRow[]> {
  return supabaseRequest<PlayerRow[]>(
    "players?select=*&order=created_at.desc&limit=20"
  );
}

function isMissingColumnError(error: unknown, columnName: string): boolean {
  return (
    error instanceof Error &&
    error.message.includes(`Could not find the '${columnName}' column`)
  );
}

export async function upsertPlayerFromQfUser(user: QfUserProfile): Promise<PlayerRow> {
  const displayName = user.name || user.email || "Player";
  const timestamp = new Date().toISOString();

  const existing = await supabaseRequest<PlayerRow[]>(
    `players?select=*&quran_foundation_uid=eq.${encodeURIComponent(user.sub)}`
  );

  if (existing[0]) {
    const updatePayload: PlayerUpdate = {
      qf_email: user.email,
      display_name: displayName,
      avatar_url: user.avatar,
      last_login_at: timestamp,
    };
    const fallbackUpdatePayload: PlayerUpdate = {
      display_name: displayName,
      avatar_url: user.avatar,
    };

    let updated: PlayerRow[];
    try {
      updated = await supabaseRequest<PlayerRow[]>(
        `players?id=eq.${existing[0].id}&select=*`,
        {
          method: "PATCH",
          body: JSON.stringify(updatePayload),
        }
      );
    } catch (error) {
      if (
        !isMissingColumnError(error, "last_login_at") &&
        !isMissingColumnError(error, "qf_email")
      ) {
        throw error;
      }

      updated = await supabaseRequest<PlayerRow[]>(
        `players?id=eq.${existing[0].id}&select=*`,
        {
          method: "PATCH",
          body: JSON.stringify(fallbackUpdatePayload),
        }
      );
    }

    if (!updated[0]) {
      throw new Error("Failed to update linked player.");
    }

    return updated[0];
  }

  const insertPayload: PlayerInsert = {
    quran_foundation_uid: user.sub,
    qf_email: user.email,
    display_name: displayName,
    avatar_url: user.avatar,
    last_login_at: timestamp,
  };
  const fallbackInsertPayload: PlayerInsert = {
    quran_foundation_uid: user.sub,
    display_name: displayName,
    avatar_url: user.avatar,
  };

  let inserted: PlayerRow[];
  try {
    inserted = await supabaseRequest<PlayerRow[]>("players?select=*", {
      method: "POST",
      body: JSON.stringify(insertPayload),
    });
  } catch (error) {
    if (
      !isMissingColumnError(error, "last_login_at") &&
      !isMissingColumnError(error, "qf_email")
    ) {
      throw error;
    }

    inserted = await supabaseRequest<PlayerRow[]>("players?select=*", {
      method: "POST",
      body: JSON.stringify(fallbackInsertPayload),
    });
  }

  if (!inserted[0]) {
    throw new Error("Failed to insert linked player.");
  }

  return inserted[0];
}
