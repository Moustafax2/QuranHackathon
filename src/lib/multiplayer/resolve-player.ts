import "server-only";

import { getUsableSession } from "@/lib/qf-user/session";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import type { ResponseCookies } from "next/dist/compiled/@edge-runtime/cookies";

/**
 * Resolves a player_id from either:
 * 1. A valid QF session cookie (authenticated users)
 * 2. An X-Guest-Player-Id request header (guest users)
 *
 * Returns null if neither is present or valid.
 */
export async function resolvePlayerId(
  request: Request,
  cookieStore?: ResponseCookies
): Promise<string | null> {
  const session = await getUsableSession(cookieStore);
  if (session) return session.player_id;

  const guestId = request.headers.get("X-Guest-Player-Id");
  if (!guestId) return null;

  // Verify the guest player row actually exists (prevents arbitrary ID injection)
  const supabase = createAdminSupabaseClient();
  const { data } = await supabase
    .from("players")
    .select("id")
    .eq("id", guestId)
    .maybeSingle();
  return data?.id ?? null;
}
