import "server-only";

import { apiGet } from "./client";
import type { VerseAudioFilesResponse } from "@/lib/types";

const VERSE_AUDIO_BASE = "https://verses.quran.foundation/";

export async function getVerseAudioFiles(
  recitationId: number,
  chapterNumber: number
): Promise<VerseAudioFilesResponse> {
  const raw = await apiGet<VerseAudioFilesResponse>(
    `/resources/recitations/${recitationId}/audio_files`,
    { chapter_number: chapterNumber, fields: "url" },
    { revalidate: 86400 }
  );

  // Resolve relative URLs to absolute
  return {
    ...raw,
    audio_files: raw.audio_files.map((f) => ({
      ...f,
      url: f.url.startsWith("http") ? f.url : `${VERSE_AUDIO_BASE}${f.url}`,
    })),
  };
}
