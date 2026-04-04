import { apiGet } from "./client";
import type { VersesResponse } from "@/lib/types";

export async function getVersesByChapter(
  chapterNumber: number
): Promise<VersesResponse> {
  const firstPage = await apiGet<VersesResponse>(
    `/verses/by_chapter/${chapterNumber}`,
    { language: "en", words: "false", translations: "131", fields: "text_uthmani", per_page: 50, page: 1 }
  );

  const { total_pages } = firstPage.pagination;
  if (total_pages <= 1) return firstPage;

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
    translations: "131",
    fields: "text_uthmani",
    per_page: 50,
  });
}
