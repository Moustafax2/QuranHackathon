import "server-only";

import { apiGet } from "./client";
import type { VersesResponse } from "@/lib/types";
import saheehTranslations from "../../../public/data/saheeh-international-en.json";

type TranslationEntry = { chapter: number; verse: number; text: string };
const translationMap = saheehTranslations as Record<string, TranslationEntry[]>;

function injectTranslations(response: VersesResponse): VersesResponse {
  return {
    ...response,
    verses: response.verses.map((verse) => {
      const [chapterStr] = verse.verse_key.split(":");
      const chapterTranslations = translationMap[chapterStr] ?? [];
      const entry = chapterTranslations.find((t) => t.verse === verse.verse_number);
      return {
        ...verse,
        translations: entry ? [{ id: verse.id, resource_id: 131, text: entry.text }] : [],
      };
    }),
  };
}

export async function getVersesByChapter(
  chapterNumber: number
): Promise<VersesResponse> {
  const firstPage = await apiGet<VersesResponse>(
    `/verses/by_chapter/${chapterNumber}`,
    { language: "en", words: "false", translations: "131", fields: "text_uthmani", per_page: 50, page: 1 }
  );

  const { total_pages } = firstPage.pagination;
  if (total_pages <= 1) return injectTranslations(firstPage);

  const remainingPages = await Promise.all(
    Array.from({ length: total_pages - 1 }, (_, i) =>
      apiGet<VersesResponse>(`/verses/by_chapter/${chapterNumber}`, {
        language: "en",
        words: "false",
        translations: "131",
        fields: "text_uthmani",
        per_page: 50,
        page: i + 2,
      })
    )
  );

  return injectTranslations({
    verses: [firstPage, ...remainingPages].flatMap((r) => r.verses),
    pagination: remainingPages[remainingPages.length - 1].pagination,
  });
}

export async function getVersesByJuz(
  juzNumber: number
): Promise<VersesResponse> {
  const firstPage = await apiGet<VersesResponse>(
    `/verses/by_juz/${juzNumber}`,
    { language: "en", words: "false", translations: "131", fields: "text_uthmani", per_page: 50, page: 1 }
  );

  const { total_pages } = firstPage.pagination;
  if (total_pages <= 1) return injectTranslations(firstPage);

  const remainingPages = await Promise.all(
    Array.from({ length: total_pages - 1 }, (_, i) =>
      apiGet<VersesResponse>(`/verses/by_juz/${juzNumber}`, {
        language: "en",
        words: "false",
        translations: "131",
        fields: "text_uthmani",
        per_page: 50,
        page: i + 2,
      })
    )
  );

  return injectTranslations({
    verses: [firstPage, ...remainingPages].flatMap((r) => r.verses),
    pagination: remainingPages[remainingPages.length - 1].pagination,
  });
}

export async function getVersesByJuzWithWords(
  juzNumber: number
): Promise<VersesResponse> {
  const firstPage = await apiGet<VersesResponse>(
    `/verses/by_juz/${juzNumber}`,
    { language: "en", words: "true", translations: "131", fields: "text_uthmani", word_fields: "text_uthmani", per_page: 50, page: 1 }
  );

  const { total_pages } = firstPage.pagination;
  if (total_pages <= 1) return injectTranslations(firstPage);

  const remainingPages = await Promise.all(
    Array.from({ length: total_pages - 1 }, (_, i) =>
      apiGet<VersesResponse>(`/verses/by_juz/${juzNumber}`, {
        language: "en",
        words: "true",
        translations: "131",
        fields: "text_uthmani",
        word_fields: "text_uthmani",
        per_page: 50,
        page: i + 2,
      })
    )
  );

  return injectTranslations({
    verses: [firstPage, ...remainingPages].flatMap((r) => r.verses),
    pagination: remainingPages[remainingPages.length - 1].pagination,
  });
}

export async function getVersesByPage(
  pageNumber: number
): Promise<VersesResponse> {
  const response = await apiGet<VersesResponse>(`/verses/by_page/${pageNumber}`, {
    language: "en",
    words: "false",
    translations: "131",
    fields: "text_uthmani",
    per_page: 50,
  });
  return injectTranslations(response);
}
