import type { LexicalEntry, UserFlashcard, WordStatus } from "@/lib/types/flashcard";
import { FSRSState } from "@/lib/types/flashcard";
import { getWordsBySurah } from "@/lib/corpus/lexical-db";
import { getFlashcards, addFlashcard } from "@/lib/storage/flashcard-storage";
import { createNewCard } from "@/lib/fsrs/scheduler";

export async function getSurahWords(surahNumber: number): Promise<LexicalEntry[]> {
  return await getWordsBySurah(surahNumber);
}

export async function filterNewWords(
  words: LexicalEntry[],
  userBank?: UserFlashcard[]
): Promise<LexicalEntry[]> {
  const bank = userBank || (await getFlashcards());
  const existingWordIds = new Set(bank.map((card) => card.word_id));
  return words.filter((word) => !existingWordIds.has(word.id));
}

export async function addWordsToBank(
  wordIds: string[],
  status: WordStatus
): Promise<void> {
  const promises = wordIds.map(async (wordId) => {
    const card: UserFlashcard = {
      id: crypto.randomUUID(),
      word_id: wordId,
      fsrs_state: createNewCard(),
      created_at: new Date(),
      status,
    };
    await addFlashcard(card);
  });

  await Promise.all(promises);
}

export async function getWordIntakeStats(surahNumber: number): Promise<{
  total: number;
  inBank: number;
  new: number;
}> {
  const words = await getSurahWords(surahNumber);
  const bank = await getFlashcards();
  const existingWordIds = new Set(bank.map((card) => card.word_id));

  return {
    total: words.length,
    inBank: words.filter((w) => existingWordIds.has(w.id)).length,
    new: words.filter((w) => !existingWordIds.has(w.id)).length,
  };
}
