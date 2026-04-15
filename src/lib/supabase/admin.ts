import "server-only";

import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";
import { getSupabaseAdminConfig } from "./env";

export function createAdminSupabaseClient() {
  const { url, serviceRoleKey } = getSupabaseAdminConfig();

  return createClient<Database>(url, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
