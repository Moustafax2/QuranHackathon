import { apiGet } from "./client";
import type { ChaptersResponse, ChapterResponse } from "@/lib/types";

export async function getChapters(): Promise<ChaptersResponse> {
  return apiGet<ChaptersResponse>("/chapters", { language: "en" });
}

export async function getChapter(id: number): Promise<ChapterResponse> {
  return apiGet<ChapterResponse>(`/chapters/${id}`, { language: "en" });
}
