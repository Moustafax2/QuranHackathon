import "server-only";

import { QuranApiError, quranContentGet } from "@/lib/quran/client";

export async function apiGet<T>(
  path: string,
  params?: Record<string, string | number | boolean>,
  options?: {
    revalidate?: number;
    cache?: RequestCache;
  }
): Promise<T> {
  return quranContentGet<T>(path, {
    params,
    revalidate: options?.revalidate,
    cache: options?.cache,
  });
}

export { QuranApiError };
