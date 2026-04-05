export type QuestionType = "next-ayah-mc" | "word-meaning-mc" | "blank-word-mc";

export interface GameSettings {
  questionTypes: QuestionType[];
  numQuestions: number;
  juzes: number[];
}

export interface QuestionOption {
  text_uthmani: string;
  verse_key: string;
  // For word-meaning-mc: the English meaning shown as the option label
  meaning?: string;
}

export interface GameQuestion {
  type: QuestionType;
  promptVerse: {
    text_uthmani: string;
    verse_key: string;
    surah_name: string;
  };
  // word-meaning-mc only: the specific Arabic word being asked about
  promptWord?: string;
  // blank-word-mc only: ordered words of the ayah, and which index is blanked
  ayahWords?: string[];
  blankWordIndex?: number;
  options: QuestionOption[];
  correctIndex: number;
}
