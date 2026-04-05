import "server-only";

import { apiGet } from "./client";
import { RECITERS } from "@/lib/quran/reciters";
import type { AudioResponse } from "@/lib/types";

export async function getChapterRecitation(
  reciterId: number,
  chapterNumber: number
): Promise<AudioResponse> {
  return apiGet<AudioResponse>(`/chapter_recitations/${reciterId}/${chapterNumber}`, undefined, {
    cache: "no-store",
  });
}

export { RECITERS };
