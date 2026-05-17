import "server-only";

import { apiGet, QuranApiError } from "./client";
import type { VersesResponse } from "@/lib/types";

const PUBLIC_QURAN_API = "https://api.quran.com/api/v4";

function isQuranApiNotFound(error: unknown): boolean {
  const status =
    typeof error === "object" && error !== null && "status" in error
      ? Number(error.status)
      : null;
  const name =
    typeof error === "object" && error !== null && "name" in error
      ? error.name
      : null;
  const message = error instanceof Error ? error.message : "";

  return (
    (error instanceof QuranApiError && error.status === 404) ||
    (name === "QuranApiError" && status === 404) ||
    message.includes("failed (404)")
  );
}

function isChapterVerse(verseKey: string, chapterNumber: number): boolean {
  return verseKey.startsWith(`${chapterNumber}:`);
}

async function getPublicVersesByChapter(
  chapterNumber: number
): Promise<VersesResponse> {
  const firstPage = await fetchPublicVersesByChapterPage(chapterNumber, 1);
  const { total_pages } = firstPage.pagination;
  if (total_pages <= 1) return firstPage;

  const remainingPages = await Promise.all(
    Array.from({ length: total_pages - 1 }, (_, i) =>
      fetchPublicVersesByChapterPage(chapterNumber, i + 2)
    )
  );

  return {
    verses: [firstPage, ...remainingPages].flatMap((response) =>
      response.verses.filter((verse) => isChapterVerse(verse.verse_key, chapterNumber))
    ),
    pagination: remainingPages[remainingPages.length - 1].pagination,
  };
}

async function fetchPublicVersesByChapterPage(
  chapterNumber: number,
  page: number
): Promise<VersesResponse> {
  const url = new URL(`${PUBLIC_QURAN_API}/verses/by_chapter/${chapterNumber}`);
  url.searchParams.set("language", "en");
  url.searchParams.set("words", "false");
  url.searchParams.set("translations", "20");
  url.searchParams.set("fields", "text_uthmani");
  url.searchParams.set("per_page", "50");
  url.searchParams.set("page", String(page));

  const response = await fetch(url, { next: { revalidate: 3600 } });
  if (!response.ok) {
    throw new Error(
      `Quran.com verses request failed (${response.status}) for chapter ${chapterNumber}.`
    );
  }

  return response.json() as Promise<VersesResponse>;
}

export async function getVersesByChapter(
  chapterNumber: number
): Promise<VersesResponse> {
  let firstPage: VersesResponse;

  try {
    firstPage = await apiGet<VersesResponse>(
      `/verses/by_chapter/${chapterNumber}`,
      { language: "en", words: "false", translations: "20", fields: "text_uthmani", per_page: 50, page: 1 }
    );
  } catch (error) {
    if (isQuranApiNotFound(error)) {
      return getPublicVersesByChapter(chapterNumber);
    }

    throw error;
  }

  const { total_pages } = firstPage.pagination;
  if (total_pages <= 1) return firstPage;

  const remainingPages = await Promise.all(
    Array.from({ length: total_pages - 1 }, (_, i) =>
      apiGet<VersesResponse>(`/verses/by_chapter/${chapterNumber}`, {
        language: "en",
        words: "false",
        translations: "20",
        fields: "text_uthmani",
        per_page: 50,
        page: i + 2,
      })
    )
  );

  return {
    verses: [firstPage, ...remainingPages].flatMap((r) => r.verses),
    pagination: remainingPages[remainingPages.length - 1].pagination,
  };
}

export async function getVersesByJuz(
  juzNumber: number
): Promise<VersesResponse> {
  const firstPage = await apiGet<VersesResponse>(
    `/verses/by_juz/${juzNumber}`,
    { language: "en", words: "false", translations: "20", fields: "text_uthmani", per_page: 50, page: 1 }
  );

  const { total_pages } = firstPage.pagination;
  if (total_pages <= 1) return firstPage;

  const remainingPages = await Promise.all(
    Array.from({ length: total_pages - 1 }, (_, i) =>
      apiGet<VersesResponse>(`/verses/by_juz/${juzNumber}`, {
        language: "en",
        words: "false",
        translations: "20",
        fields: "text_uthmani",
        per_page: 50,
        page: i + 2,
      })
    )
  );

  return {
    verses: [firstPage, ...remainingPages].flatMap((r) => r.verses),
    pagination: remainingPages[remainingPages.length - 1].pagination,
  };
}

export async function getVersesByJuzWithWords(
  juzNumber: number
): Promise<VersesResponse> {
  const firstPage = await apiGet<VersesResponse>(
    `/verses/by_juz/${juzNumber}`,
    { language: "en", words: "true", translations: "20", fields: "text_uthmani", word_fields: "text_uthmani", per_page: 50, page: 1 }
  );

  const { total_pages } = firstPage.pagination;
  if (total_pages <= 1) return firstPage;

  const remainingPages = await Promise.all(
    Array.from({ length: total_pages - 1 }, (_, i) =>
      apiGet<VersesResponse>(`/verses/by_juz/${juzNumber}`, {
        language: "en",
        words: "true",
        translations: "20",
        fields: "text_uthmani",
        word_fields: "text_uthmani",
        per_page: 50,
        page: i + 2,
      })
    )
  );

  return {
    verses: [firstPage, ...remainingPages].flatMap((r) => r.verses),
    pagination: remainingPages[remainingPages.length - 1].pagination,
  };
}

export async function getVersesByPage(
  pageNumber: number
): Promise<VersesResponse> {
  return apiGet<VersesResponse>(`/verses/by_page/${pageNumber}`, {
    language: "en",
    words: "false",
    translations: "20",
    fields: "text_uthmani",
    per_page: 50,
  });
}
