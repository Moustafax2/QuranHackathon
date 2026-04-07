"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getFlashcards, getReviewLog, migrateFromLocalStorage } from "@/lib/storage/flashcard-storage-supabase";
import { getDueCardsCount, getNewCardsCount } from "@/lib/flashcard/session-manager";
import { addDemoCards } from "@/lib/flashcard/demo-helper";

function SRExplainerModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm px-4" onClick={onClose}>
      <div
        className="w-full max-w-2xl rounded-2xl border border-gray-700 bg-gray-900 p-8 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="mb-2 text-2xl font-bold text-white">What is Spaced Repetition?</h2>
        <p className="mb-5 text-sm text-gray-500">The science behind how this app helps you memorize Quranic vocabulary</p>

        <div className="space-y-4 text-sm text-gray-300">
          <p>
            <strong className="text-white">Spaced repetition</strong> is a learning technique that shows you
            flashcards at increasing intervals over time — right before you would forget them. By reviewing at the{" "}
            <em>optimal moment</em>, you spend less time studying while retaining more.
          </p>
          <p>
            The key insight is the <strong className="text-white">forgetting curve</strong>: memory decays
            exponentially after learning. If you review just before forgetting, your memory is strengthened and
            the next interval can be longer. Over weeks and months, you build durable long-term memory with
            minimal effort.
          </p>

          <div className="rounded-xl border border-gray-700 bg-gray-800 p-4">
            <p className="mb-2 font-semibold text-white">How ratings work</p>
            <div className="grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">
              <div className="rounded-lg bg-red-500/10 p-3">
                <div className="mb-1 font-bold text-red-400">Again</div>
                <div className="text-gray-400">Complete forget — card is re-shown this session and scheduled soon</div>
              </div>
              <div className="rounded-lg bg-orange-500/10 p-3">
                <div className="mb-1 font-bold text-orange-400">Hard</div>
                <div className="text-gray-400">Recalled with difficulty — short interval, easiness decreases</div>
              </div>
              <div className="rounded-lg bg-emerald-500/10 p-3">
                <div className="mb-1 font-bold text-emerald-400">Good</div>
                <div className="text-gray-400">Correct recall — interval grows normally</div>
              </div>
              <div className="rounded-lg bg-blue-500/10 p-3">
                <div className="mb-1 font-bold text-blue-400">Easy</div>
                <div className="text-gray-400">Instant recall — interval grows quickly</div>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-gray-700 bg-gray-800 p-4">
            <p className="mb-3 font-semibold text-white">Algorithms used</p>
            <div className="space-y-3 text-xs">
              <div>
                <span className="font-semibold text-emerald-400">FSRS</span>{" "}
                <span className="text-gray-500">(default)</span> — Free Spaced Repetition Scheduler by Jarrett Ye
                et al. (2022). A state-of-the-art algorithm based on the{" "}
                <em>DSR model</em> (Difficulty, Stability, Retrievability). Significantly outperforms SM-2 in
                predicting the optimal review time.{" "}
                <a
                  href="https://github.com/open-spaced-repetition/fsrs4anki"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-emerald-400 underline"
                >
                  GitHub
                </a>
              </div>
              <div>
                <span className="font-semibold text-amber-400">SM-2</span>{" "}
                <span className="text-gray-500">(legacy)</span> — SuperMemo 2 by Piotr Wozniak (1987). The
                original spaced repetition algorithm, popularized by Anki. Uses a fixed easiness factor per
                card to determine intervals. Simpler but less accurate than FSRS.{" "}
                <a
                  href="https://github.com/ankitects/anki"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-amber-400 underline"
                >
                  Anki (GitHub)
                </a>
              </div>
            </div>
          </div>
        </div>

        <button
          onClick={onClose}
          className="mt-6 w-full rounded-xl bg-emerald-600 px-6 py-3 font-semibold text-white transition-all hover:bg-emerald-500"
        >
          Got it
        </button>
      </div>
    </div>
  );
}

export default function FlashcardsHubPage() {
  const [dueCount, setDueCount] = useState(0);
  const [newCount, setNewCount] = useState(0);
  const [totalCards, setTotalCards] = useState(0);
  const [loading, setLoading] = useState(true);
  const [addingDemo, setAddingDemo] = useState(false);
  const [showSRExplainer, setShowSRExplainer] = useState(false);

  useEffect(() => {
    async function initializeAndLoad() {
      await migrateFromLocalStorage();
      await loadStats();
    }
    initializeAndLoad();
  }, []);

  async function loadStats() {
    const [due, newCards, cards] = await Promise.all([
      getDueCardsCount(),
      getNewCardsCount(),
      getFlashcards(),
    ]);
    setDueCount(due);
    setNewCount(newCards);
    setTotalCards(cards.length);
    setLoading(false);
  }

  async function handleAddDemo() {
    setAddingDemo(true);
    try {
      await addDemoCards();
      await loadStats();
    } catch (error) {
      console.error("Failed to add demo cards:", error);
    } finally {
      setAddingDemo(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-950">
        <div className="text-center">
          <div className="mb-4 h-12 w-12 animate-spin rounded-full border-4 border-emerald-500 border-t-transparent"></div>
          <p className="text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

  const hasCards = totalCards > 0;

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-950 to-gray-900 px-4 py-12">
      {showSRExplainer && <SRExplainerModal onClose={() => setShowSRExplainer(false)} />}
      <div className="mx-auto max-w-4xl">
        <div className="mb-12 text-center">
          <h1 className="mb-3 text-4xl font-bold text-white">
            Ready to learn?
          </h1>
          <p className="mb-4 text-gray-400">
            Master Quranic vocabulary with spaced repetition
          </p>
          <button
            onClick={() => setShowSRExplainer(true)}
            className="inline-flex items-center gap-2 rounded-full border border-gray-700 bg-gray-800/60 px-4 py-1.5 text-xs text-gray-400 transition-all hover:border-emerald-500/50 hover:text-emerald-400"
          >
            <span className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-current text-[10px] font-bold">i</span>
            What is spaced repetition?
          </button>
        </div>

        {hasCards ? (
          <>
            <div className="mb-8 grid gap-4 sm:grid-cols-2">
              <Link
                href="/train/flashcards/review"
                className="group relative overflow-hidden rounded-3xl border border-emerald-500/30 bg-gradient-to-br from-emerald-600 to-emerald-700 p-8 shadow-xl transition-all hover:scale-105 hover:shadow-2xl hover:shadow-emerald-500/20"
              >
                <div className="absolute right-4 top-4 text-6xl opacity-20">▶</div>
                <div className="relative">
                  <div className="mb-2 text-sm font-medium text-emerald-200">
                    Review Session
                  </div>
                  <div className="mb-4 text-4xl font-bold text-white">
                    {dueCount} cards due
                  </div>
                  <div className="text-sm text-emerald-100">
                    Start your review now
                  </div>
                </div>
              </Link>

              <Link
                href="/train/flashcards/select"
                className="group relative overflow-hidden rounded-3xl border border-blue-500/30 bg-gradient-to-br from-blue-600 to-blue-700 p-8 shadow-xl transition-all hover:scale-105 hover:shadow-2xl hover:shadow-blue-500/20"
              >
                <div className="absolute right-4 top-4 text-6xl opacity-20">📖</div>
                <div className="relative">
                  <div className="mb-2 text-sm font-medium text-blue-200">
                    Learn New Words
                  </div>
                  <div className="mb-4 text-4xl font-bold text-white">
                    Explore Surahs
                  </div>
                  <div className="text-sm text-blue-100">
                    Add words to your deck
                  </div>
                </div>
              </Link>
            </div>

            <div className="mb-8 grid gap-4 sm:grid-cols-3">
              <div className="rounded-2xl border border-gray-800 bg-gray-900 p-6">
                <div className="mb-2 text-sm text-gray-500">Total Words</div>
                <div className="text-3xl font-bold text-white">{totalCards}</div>
              </div>
              <div className="rounded-2xl border border-gray-800 bg-gray-900 p-6">
                <div className="mb-2 text-sm text-gray-500">New Cards</div>
                <div className="text-3xl font-bold text-blue-400">{newCount}</div>
              </div>
              <div className="rounded-2xl border border-gray-800 bg-gray-900 p-6">
                <div className="mb-2 text-sm text-gray-500">Due Today</div>
                <div className="text-3xl font-bold text-emerald-400">{dueCount}</div>
              </div>
            </div>
          </>
        ) : (
          <div className="mb-8 text-center">
            <div className="mb-6 text-6xl">📚</div>
            <h2 className="mb-3 text-2xl font-bold text-white">
              Start Your Journey
            </h2>
            <p className="mb-8 text-gray-400">
              You haven't added any words yet. Select a surah to begin learning!
            </p>
            <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
              <Link
                href="/train/flashcards/select"
                className="inline-block rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-700 px-8 py-4 font-semibold text-white shadow-lg transition-all hover:scale-105 hover:shadow-xl"
              >
                Choose a Surah
              </Link>
              <button
                onClick={handleAddDemo}
                disabled={addingDemo}
                className="inline-block rounded-xl border border-emerald-600 bg-emerald-600/10 px-8 py-4 font-semibold text-emerald-400 shadow-lg transition-all hover:scale-105 hover:bg-emerald-600/20 hover:shadow-xl disabled:opacity-50"
              >
                {addingDemo ? "Adding..." : "Quick Demo (5 cards)"}
              </button>
            </div>
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-3">
          <Link
            href="/train/flashcards/settings"
            className="flex items-center gap-3 rounded-xl border border-gray-800 bg-gray-900 p-4 transition-all hover:border-gray-700 hover:bg-gray-800"
          >
            <div className="text-2xl">⚙️</div>
            <div>
              <div className="font-medium text-white">Settings</div>
              <div className="text-sm text-gray-500">Customize your learning</div>
            </div>
          </Link>
          <Link
            href="/train/flashcards/stats"
            className="flex items-center gap-3 rounded-xl border border-gray-800 bg-gray-900 p-4 transition-all hover:border-gray-700 hover:bg-gray-800"
          >
            <div className="text-2xl">📊</div>
            <div>
              <div className="font-medium text-white">Statistics</div>
              <div className="text-sm text-gray-500">View your progress</div>
            </div>
          </Link>
          <Link
            href="/train"
            className="flex items-center gap-3 rounded-xl border border-gray-800 bg-gray-900 p-4 transition-all hover:border-gray-700 hover:bg-gray-800"
          >
            <div className="text-2xl">◀️</div>
            <div>
              <div className="font-medium text-white">Back to Training</div>
              <div className="text-sm text-gray-500">Other training modes</div>
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
}
