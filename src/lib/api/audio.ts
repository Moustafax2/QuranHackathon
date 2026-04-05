import "server-only";

import { apiGet } from "./client";
import type { AudioResponse } from "@/lib/types";

export async function getChapterRecitation(
  reciterId: number,
  chapterNumber: number
): Promise<AudioResponse> {
  return apiGet<AudioResponse>(
    `/chapter_recitations/${reciterId}/${chapterNumber}`
  );
}
