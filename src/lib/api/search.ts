import "server-only";

import { apiGet, QuranApiError } from "./client";
import type { SearchResponse } from "@/lib/types";

export class SearchUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SearchUnavailableError";
  }
}

export function isSearchUnavailableError(
  error: unknown
): error is SearchUnavailableError {
  return error instanceof SearchUnavailableError;
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
      { revalidate: false }
    );
  } catch (error) {
    if (
      error instanceof QuranApiError &&
      (error.status === 403 ||
        error.status === 404 ||
        error.type === "insufficient_scope")
    ) {
      throw new SearchUnavailableError(
        "Search is not available for the current Quran Foundation credentials or environment."
      );
    }

    throw error;
  }
}
