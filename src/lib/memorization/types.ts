export interface AyahQuestion {
  mode: "ayah";
  verseKey: string;
  pageNumber: number;
  surahName: string;
  surahId: number;
  juzNumber: number;
  displayText: string;
  fullText: string;
  positionOnPage: number;
}

export interface PageBlankQuestion {
  mode: "page-blank";
  pageNumber: number;
  juzNumber: number | null;
  surahId: number | null;
  coverRegion: "top" | "middle" | "bottom";
  hasSurahHeader: boolean;
}

export type MemorizationQuestion = AyahQuestion | PageBlankQuestion;

export type MemorizationSelectionType = "juz" | "surah";

export interface MemorizationAttempt {
  id: string;
  client_attempt_id: string;
  mode: MemorizationQuestion["mode"];
  rating_level: 0 | 1 | 2;
  verse_key: string | null;
  surah_id: number | null;
  ayah_number: number | null;
  juz_number: number | null;
  page_number: number | null;
  selection_type: MemorizationSelectionType | null;
  cover_region: PageBlankQuestion["coverRegion"] | null;
  tested_at: Date;
}

export interface MemorizationAttemptInput {
  client_attempt_id?: string;
  mode: MemorizationQuestion["mode"];
  rating_level: 0 | 1 | 2;
  verse_key?: string | null;
  surah_id?: number | null;
  ayah_number?: number | null;
  juz_number?: number | null;
  page_number?: number | null;
  selection_type?: MemorizationSelectionType | null;
  cover_region?: PageBlankQuestion["coverRegion"] | null;
  tested_at?: Date;
}
