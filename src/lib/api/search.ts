import "server-only";

import {
  QuranApiError,
  quranContentGet,
  quranFoundationGet,
} from "@/lib/quran/client";
import { QuranAuthError } from "@/lib/quran/auth";
import type { SearchResponse, SearchResult } from "@/lib/types";

interface ContentSearchResult {
  verse_key: string;
  verse_id: number;
  text: string;
  highlighted: string | null;
  translations?: {
    text: string;
    resource_id: number;
    name: string;
    language_name: string;
  }[];
}

interface ContentSearchResponse {
  search: {
    query: string;
    total_results: number;
    current_page: number;
    total_pages: number;
    results: ContentSearchResult[];
  };
}

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

function isUnavailableSearchError(error: unknown): boolean {
  return (
    (error instanceof QuranApiError &&
      [400, 401, 403, 404].includes(error.status)) ||
    (error instanceof QuranAuthError &&
      [400, 401, 403].includes(error.status))
  );
}

function stripHtml(value: string): string {
  return value.replace(/<[^>]*>/g, "");
}

function normalizeContentSearchResponse(
  response: ContentSearchResponse
): SearchResponse {
  const verses: SearchResult[] = response.search.results.map((result) => ({
    result_type: "ayah",
    key: result.verse_key,
    name: stripHtml(result.translations?.[0]?.text ?? result.highlighted ?? result.text),
    arabic: stripHtml(result.text),
    isArabic: false,
  }));

  return {
    pagination: {
      current_page: response.search.current_page,
      next_page:
        response.search.current_page < response.search.total_pages
          ? response.search.current_page + 1
          : null,
      per_page: 20,
      total_pages: response.search.total_pages,
      total_records: response.search.total_results,
    },
    result: {
      navigation: [],
      verses,
    },
  };
}

async function searchWithContentApi(
  query: string,
  page: number
): Promise<SearchResponse> {
  const response = await quranContentGet<ContentSearchResponse>("/search", {
    params: {
      q: query,
      size: 20,
      page,
      language: "en",
    },
    revalidate: 300,
  });

  return normalizeContentSearchResponse(response);
}

export async function searchQuran(
  query: string,
  page = 1
): Promise<SearchResponse> {
  try {
    return await quranFoundationGet<SearchResponse>(
      "/api/v1/search",
      {
        params: {
          query,
          mode: "advanced",
          size: 20,
          page,
          get_text: "1",
          highlight: "1",
        },
        revalidate: 300,
        authScope: "search",
      }
    );
  } catch (error) {
    if (isUnavailableSearchError(error)) {
      try {
        return await searchWithContentApi(query, page);
      } catch (fallbackError) {
        if (!isUnavailableSearchError(fallbackError)) {
          throw fallbackError;
        }

        throw new QuranSearchUnavailableError(
          "Search is not available for the current Quran Foundation environment or scope."
        );
      }
    }

    throw error;
  }
}
