import { apiGet } from "./client";
import type { VersesResponse } from "@/lib/types";

export async function getVersesByChapter(
  chapterNumber: number,
  page = 1,
  perPage = 50
): Promise<VersesResponse> {
  return apiGet<VersesResponse>(`/verses/by_chapter/${chapterNumber}`, {
    language: "en",
    words: "false",
    translations: "131",
    fields: "text_uthmani",
    per_page: perPage,
    page,
  });
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
