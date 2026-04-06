"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getFlashcards, getReviewLog } from "@/lib/storage/flashcard-storage";
import { getDueCardsCount, getNewCardsCount } from "@/lib/flashcard/session-manager";
import { addDemoCards } from "@/lib/flashcard/demo-helper";

export default function FlashcardsHubPage() {
  const [dueCount, setDueCount] = useState(0);
  const [newCount, setNewCount] = useState(0);
  const [totalCards, setTotalCards] = useState(0);
  const [loading, setLoading] = useState(true);
  const [addingDemo, setAddingDemo] = useState(false);

  useEffect(() => {
    loadStats();
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
      <div className="mx-auto max-w-4xl">
        <div className="mb-12 text-center">
          <h1 className="mb-3 text-4xl font-bold text-white">
            Ready to learn?
          </h1>
          <p className="text-gray-400">
            Master Quranic vocabulary with spaced repetition
          </p>
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
