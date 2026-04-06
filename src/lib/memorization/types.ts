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
  coverRegion: "top" | "middle" | "bottom";
  hasSurahHeader: boolean;
}

export type MemorizationQuestion = AyahQuestion | PageBlankQuestion;
