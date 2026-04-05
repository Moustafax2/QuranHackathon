import "server-only";

import { QuranApiError, apiGet } from "./client";
import type { SearchResponse } from "@/lib/types";

export class QuranSearchUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "QuranSearchUnavailableError";
  }
}

export function isQuranSearchUnavailableError(
  error: unknown
): error is QuranSearchUnavailableError {
  return error instanceof QuranSearchUnavailableError;
}

export async function searchQuran(
  query: string,
  page = 1
): Promise<SearchResponse> {
  try {
    return await apiGet<SearchResponse>(
      "/search",
      {
        q: query,
        size: 20,
        page,
        language: "en",
      },
      { revalidate: 300 }
    );
  } catch (error) {
    if (
      error instanceof QuranApiError &&
      [401, 403, 404].includes(error.status)
    ) {
      throw new QuranSearchUnavailableError(
        "Search is not available for the current Quran Foundation environment or scope."
      );
    }

    throw error;
  }
}
