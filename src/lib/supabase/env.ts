function clean(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function getSupabaseTarget(): "remote" | "local" {
  return clean(process.env.NEXT_PUBLIC_SUPABASE_TARGET) === "local"
    ? "local"
    : "remote";
}

export function getSupabasePublicConfig() {
  const target = getSupabaseTarget();

  const url =
    target === "local"
      ? clean(process.env.NEXT_PUBLIC_SUPABASE_URL_LOCAL) ?? clean(process.env.NEXT_PUBLIC_SUPABASE_URL)
      : clean(process.env.NEXT_PUBLIC_SUPABASE_URL);

  const anonKey =
    target === "local"
      ? clean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY_LOCAL) ?? clean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
      : clean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

  if (!url || !anonKey) {
    throw new Error(`Missing Supabase public configuration for target "${target}".`);
  }

  return { url, anonKey, target };
}

export function getSupabaseAdminConfig() {
  const { url, target } = getSupabasePublicConfig();

  const serviceRoleKey =
    target === "local"
      ? clean(process.env.SUPABASE_SERVICE_ROLE_KEY_LOCAL) ?? clean(process.env.SUPABASE_SERVICE_ROLE_KEY)
      : clean(process.env.SUPABASE_SERVICE_ROLE_KEY);

  if (!serviceRoleKey) {
    throw new Error(`Missing Supabase admin configuration for target "${target}".`);
  }

  return { url, serviceRoleKey, target };
}

