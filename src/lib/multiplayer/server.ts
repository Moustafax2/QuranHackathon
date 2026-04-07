import "server-only";

export async function invokeSupabaseEdgeFunction<T>(
  functionName: string,
  body: Record<string, unknown>
): Promise<T> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !anonKey) {
    throw new Error("Missing Supabase edge function configuration.");
  }

  const response = await fetch(`${supabaseUrl}/functions/v1/${functionName}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${anonKey}`,
      "Content-Type": "application/json",
      apikey: anonKey,
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });

  const payload = (await response.json().catch(() => null)) as
    | (T & { error?: string })
    | null;

  if (!response.ok) {
    throw new Error(payload?.error ?? `Supabase function ${functionName} failed.`);
  }

  return payload as T;
}
