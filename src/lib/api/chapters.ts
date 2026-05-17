import "server-only";

import { apiGet, QuranApiError } from "./client";
import type { ChaptersResponse, ChapterResponse } from "@/lib/types";

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

export async function getChapters(): Promise<ChaptersResponse> {
  return apiGet<ChaptersResponse>("/chapters", { language: "en" });
}

async function getPublicChapter(id: number): Promise<ChapterResponse> {
  const response = await fetch(`${PUBLIC_QURAN_API}/chapters/${id}?language=en`, {
    next: { revalidate: 3600 },
  });

  if (!response.ok) {
    throw new Error(`Quran.com chapter request failed (${response.status}) for ${id}.`);
  }

  return response.json() as Promise<ChapterResponse>;
}

export async function getChapter(id: number): Promise<ChapterResponse> {
  try {
    return await apiGet<ChapterResponse>(`/chapters/${id}`, { language: "en" });
  } catch (error) {
    if (isQuranApiNotFound(error)) {
      try {
        return await getPublicChapter(id);
      } catch {
        // The chapter list endpoint is usually more reliable than individual
        // chapter lookups in the Quran Foundation content API.
      }

      const { chapters } = await getChapters();
      const chapter = chapters.find((item) => item.id === id);
      if (chapter) return { chapter };
    }

    throw error;
  }
}
