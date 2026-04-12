import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "./types";
import { getSupabasePublicConfig } from "./env";

export function createClient() {
  const { url, anonKey } = getSupabasePublicConfig();

  return createBrowserClient<Database>(
    url,
    anonKey
  );
}
