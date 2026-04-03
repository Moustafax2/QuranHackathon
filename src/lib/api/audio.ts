import { apiGet } from "./client";
import type { AudioResponse } from "@/lib/types";

export const RECITERS = [
  { id: 7, name: "Mishari Rashid al-`Afasy", style: null },
  { id: 1, name: "Abdul Basit Abdul Samad", style: "Murattal" },
  { id: 5, name: "Abu Bakr al-Shatri", style: null },
  { id: 6, name: "Maher Al Muaiqly", style: null },
  { id: 2, name: "Abdur-Rahman as-Sudais", style: null },
] as const;

export async function getChapterRecitation(
  reciterId: number,
  chapterNumber: number
): Promise<AudioResponse> {
  return apiGet<AudioResponse>(
    `/chapter_recitations/${reciterId}/${chapterNumber}`
  );
}
