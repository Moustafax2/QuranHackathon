import "server-only";

import { apiGet } from "./client";
import type { VersesResponse } from "@/lib/types";

const DEFAULT_VERSE_QUERY = {
  language: "en",
  words: "false",
  translations: "131",
  fields: "text_uthmani",
  per_page: 50,
} as const;

async function getPaginatedVerses(
  path: string,
  params: Record<string, string | number>
): Promise<VersesResponse> {
  const firstPage = await apiGet<VersesResponse>(path, {
    ...params,
    page: 1,
  });

  const { total_pages: totalPages } = firstPage.pagination;

  if (totalPages <= 1) {
    return firstPage;
  }

  const remainingPages = await Promise.all(
    Array.from({ length: totalPages - 1 }, (_, index) =>
      apiGet<VersesResponse>(path, {
        ...params,
        page: index + 2,
      })
    )
  );

  const allPages = [firstPage, ...remainingPages];

  return {
    verses: allPages.flatMap((page) => page.verses),
    pagination: allPages[allPages.length - 1].pagination,
  };
}

export async function getVersesByChapter(
  chapterNumber: number
): Promise<VersesResponse> {
  return getPaginatedVerses(`/verses/by_chapter/${chapterNumber}`, {
    ...DEFAULT_VERSE_QUERY,
  });
}

export async function getVersesByPage(
  pageNumber: number
): Promise<VersesResponse> {
  return getPaginatedVerses(`/verses/by_page/${pageNumber}`, {
    ...DEFAULT_VERSE_QUERY,
  });
}
