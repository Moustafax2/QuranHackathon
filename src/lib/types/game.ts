export type QuestionType = "next-ayah-mc";

export interface GameSettings {
  questionTypes: QuestionType[];
  numQuestions: number;
  juzes: number[];
}

export interface QuestionOption {
  text_uthmani: string;
  verse_key: string;
}

export interface GameQuestion {
  type: QuestionType;
  promptVerse: {
    text_uthmani: string;
    verse_key: string;
    surah_name: string;
  };
  options: QuestionOption[];
  correctIndex: number;
}
