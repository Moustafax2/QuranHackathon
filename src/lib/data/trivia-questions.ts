import triviaBank from "./trivia-questions.json";
import type { GameQuestion, QuestionOption } from "@/lib/types/game";

export interface TriviaQuestion {
  id: string;
  difficulty: "easy" | "medium" | "hard";
  question: string;
  options: string[];
  correctIndex: number;
  sourceReference: string;
}

export const TRIVIA_QUESTIONS: TriviaQuestion[] = triviaBank as TriviaQuestion[];

/**
 * Pick `count` random trivia questions without repeats.
 * Returns a shuffled subset of the bank.
 */
export function pickTriviaQuestions(count: number): TriviaQuestion[] {
  const shuffled = [...TRIVIA_QUESTIONS].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(count, shuffled.length));
}

/**
 * Convert a TriviaQuestion into the GameQuestion format used by the rest of
 * the game system.  We use synthetic verse_keys prefixed with "trivia-" so
 * the existing answer-submission pipeline works unchanged.
 */
export function triviaToGameQuestion(t: TriviaQuestion): GameQuestion {
  const options: QuestionOption[] = t.options.map((text, i) => ({
    text_uthmani: text,
    verse_key: `${t.id}:${i}`,
  }));

  return {
    type: "trivia",
    promptVerse: {
      text_uthmani: t.question,
      verse_key: t.id,
      surah_name: "Quran Trivia",
    },
    options,
    correctIndex: t.correctIndex,
  };
}
