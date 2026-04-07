import "server-only";

import type { Database } from "@/lib/supabase/types";
import type { QfUserProfile } from "./types";

type PlayerRow = Database["public"]["Tables"]["players"]["Row"];
type PlayerInsert = Database["public"]["Tables"]["players"]["Insert"];
type PlayerUpdate = Database["public"]["Tables"]["players"]["Update"];

function getSupabaseAdminConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (!url || !serviceRoleKey) {
    throw new Error("Missing Supabase admin configuration.");
  }

  return { url, serviceRoleKey };
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

    const updated = await supabaseRequest<PlayerRow[]>(
      `players?id=eq.${existing[0].id}&select=*`,
      {
        method: "PATCH",
        body: JSON.stringify(updatePayload),
      }
    );

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

  const inserted = await supabaseRequest<PlayerRow[]>("players?select=*", {
    method: "POST",
    body: JSON.stringify(insertPayload),
  });

  if (!inserted[0]) {
    throw new Error("Failed to insert linked player.");
  }

  return inserted[0];
}
