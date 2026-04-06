"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CardType, WordStatus } from "@/lib/types/flashcard";
import type { LexicalEntry } from "@/lib/types/flashcard";
import {
  getSurahWords,
  filterNewWords,
  addWordsToBank,
} from "@/lib/flashcard/intake-manager";

type WordAction = "skip" | "known" | "learn";

function IntakeContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const surahNumber = parseInt(searchParams.get("surah") || "1");

  const [words, setWords] = useState<LexicalEntry[]>([]);
  const [wordActions, setWordActions] = useState<Map<string, WordAction>>(new Map());
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | CardType>("all");

  useEffect(() => {
    async function loadWords() {
      const allWords = await getSurahWords(surahNumber);
      const newWords = await filterNewWords(allWords);
      setWords(newWords);
      setLoading(false);
    }
    loadWords();
  }, [surahNumber]);

  const handleAction = (wordId: string, action: WordAction) => {
    setWordActions((prev) => {
      const next = new Map(prev);
      if (action === "skip") {
        next.delete(wordId);
      } else {
        next.set(wordId, action);
      }
      return next;
    });
  };

  const handleFinish = async () => {
    const learnWords: string[] = [];
    const knownWords: string[] = [];

    wordActions.forEach((action, wordId) => {
      if (action === "learn") learnWords.push(wordId);
      else if (action === "known") knownWords.push(wordId);
    });

    if (learnWords.length > 0) {
      await addWordsToBank(learnWords, WordStatus.IN_BANK);
    }
    if (knownWords.length > 0) {
      await addWordsToBank(knownWords, WordStatus.KNOWN_NOT_IN_BANK);
    }

    router.push("/train/flashcards");
  };

  const filteredWords = words.filter(
    (word) => filter === "all" || word.type === filter
  );

  const learnCount = Array.from(wordActions.values()).filter(
    (a) => a === "learn"
  ).length;
  const knownCount = Array.from(wordActions.values()).filter(
    (a) => a === "known"
  ).length;

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-950">
        <div className="text-center">
          <div className="mb-4 h-12 w-12 animate-spin rounded-full border-4 border-emerald-500 border-t-transparent"></div>
          <p className="text-gray-400">Loading words...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 px-4 py-8 pb-32">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8">
          <h1 className="mb-2 text-3xl font-bold text-white">
            Select Words to Learn
          </h1>
          <p className="text-gray-400">Surah {surahNumber}</p>
        </div>

        <div className="mb-6 flex flex-wrap items-center gap-3">
          <button
            onClick={() => setFilter("all")}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition-all ${
              filter === "all"
                ? "bg-emerald-600 text-white"
                : "bg-gray-800 text-gray-400 hover:bg-gray-700"
            }`}
          >
            All
          </button>
          <button
            onClick={() => setFilter(CardType.VERB)}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition-all ${
              filter === CardType.VERB
                ? "bg-blue-600 text-white"
                : "bg-gray-800 text-gray-400 hover:bg-gray-700"
            }`}
          >
            Verbs
          </button>
          <button
            onClick={() => setFilter(CardType.NOUN)}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition-all ${
              filter === CardType.NOUN
                ? "bg-purple-600 text-white"
                : "bg-gray-800 text-gray-400 hover:bg-gray-700"
            }`}
          >
            Nouns
          </button>
          <button
            onClick={() => setFilter(CardType.PARTICLE)}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition-all ${
              filter === CardType.PARTICLE
                ? "bg-amber-600 text-white"
                : "bg-gray-800 text-gray-400 hover:bg-gray-700"
            }`}
          >
            Particles
          </button>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredWords.map((word) => {
            const action = wordActions.get(word.id);
            return (
              <div
                key={word.id}
                className={`rounded-2xl border p-6 transition-all ${
                  action === "learn"
                    ? "border-emerald-500 bg-emerald-500/10"
                    : action === "known"
                    ? "border-green-500 bg-green-500/10"
                    : "border-gray-800 bg-gray-900"
                }`}
              >
                <div className="mb-4">
                  <div className="mb-2 font-amiri text-3xl text-white">
                    {word.canonical_form}
                  </div>
                  <div className="mb-2 text-emerald-400">{word.translation}</div>
                  <div className="text-xs text-gray-500">{word.type}</div>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => handleAction(word.id, "known")}
                    className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-all ${
                      action === "known"
                        ? "border-green-500 bg-green-500/20 text-green-400"
                        : "border-gray-700 bg-gray-800 text-gray-400 hover:border-green-500 hover:text-green-400"
                    }`}
                  >
                    ✓ Known
                  </button>
                  <button
                    onClick={() => handleAction(word.id, "learn")}
                    className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-all ${
                      action === "learn"
                        ? "border-emerald-500 bg-emerald-500/20 text-emerald-400"
                        : "border-gray-700 bg-gray-800 text-gray-400 hover:border-emerald-500 hover:text-emerald-400"
                    }`}
                  >
                    + Learn
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {filteredWords.length === 0 && (
          <div className="py-12 text-center text-gray-500">
            No words found for this filter
          </div>
        )}
      </div>

      <div className="fixed bottom-0 left-0 right-0 border-t border-gray-800 bg-gray-950/95 p-4 backdrop-blur-sm">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <div className="text-sm text-gray-400">
            <span className="text-emerald-400">{learnCount} to learn</span>
            {" • "}
            <span className="text-green-400">{knownCount} known</span>
          </div>
          <button
            onClick={handleFinish}
            disabled={learnCount === 0 && knownCount === 0}
            className="rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-700 px-6 py-3 font-semibold text-white shadow-lg transition-all hover:scale-105 hover:shadow-xl disabled:opacity-50 disabled:hover:scale-100"
          >
            Finish Selection
          </button>
        </div>
      </div>
    </div>
  );
}

export default function IntakePage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center bg-gray-950">
        <div className="text-center">
          <div className="mb-4 h-12 w-12 animate-spin rounded-full border-4 border-emerald-500 border-t-transparent"></div>
          <p className="text-gray-400">Loading...</p>
        </div>
      </div>
    }>
      <IntakeContent />
    </Suspense>
  );
}
