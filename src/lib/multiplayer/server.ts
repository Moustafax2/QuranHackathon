import "server-only";
import { getSupabaseAdminConfig } from "@/lib/supabase/env";

function normalizeEnvValue(value: string | undefined): string | null {
  const normalized = value?.trim().replace(/^['"]|['"]$/g, "");
  return normalized ? normalized : null;
}

function isJwtLikeToken(value: string): boolean {
  return value.split(".").length === 3;
}

export async function invokeSupabaseEdgeFunction<T>(
  functionName: string,
  body: Record<string, unknown>
): Promise<T> {
  const adminConfig = getSupabaseAdminConfig();
  const supabaseUrl = normalizeEnvValue(adminConfig.url);
  const serviceRoleKey = normalizeEnvValue(adminConfig.serviceRoleKey);

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Missing Supabase edge function configuration.");
  }

  const headers: HeadersInit = {
    apikey: serviceRoleKey,
    "Content-Type": "application/json",
  };

  // JWT-shaped keys can be forwarded as bearer tokens. Newer Supabase secret
  // keys are not JWTs and should be sent via `apikey` only.
  if (isJwtLikeToken(serviceRoleKey)) {
    headers.Authorization = `Bearer ${serviceRoleKey}`;
  }

  const response = await fetch(`${supabaseUrl}/functions/v1/${functionName}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
    cache: "no-store",
  });

  const raw = await response.text().catch(() => "");
  let payload: (T & { error?: string }) | { error?: string } | null = null;
  try {
    payload = JSON.parse(raw) as typeof payload;
  } catch {
    // Response was not JSON.
  }

  if (!response.ok) {
    const errBody = (payload as { error?: string } | null)?.error;
    const msg =
      errBody ??
      (raw || `Supabase function ${functionName} failed (${response.status}).`);
    const authHint =
      response.status === 401 && !isJwtLikeToken(serviceRoleKey)
        ? " Ensure SUPABASE_SERVICE_ROLE_KEY is a valid Supabase secret/service key and that the edge function accepts API key auth."
        : "";
    throw new Error(`${msg}${authHint}`);
  }

  return payload as T;
}
