"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getFlashcards, getReviewLog, migrateFromLocalStorage } from "@/lib/storage/flashcard-storage-supabase";
import { getDueCardsCount, getNewCardsCount } from "@/lib/flashcard/session-manager";
import type { ReviewLogEntry } from "@/lib/types/flashcard";
import { addDemoCards } from "@/lib/flashcard/demo-helper";
import { useAuth } from "@/lib/hooks/useAuth";

function HowItWorksModal({ onClose }: { onClose: () => void }) {
  const [page, setPage] = useState(0);
  const totalPages = 3;

  const pages = [
    {
      title: "How it works",
      subtitle: "Understanding your deck and review sessions",
      content: (
        <div className="space-y-4 text-sm text-gray-300">
          <div className="rounded-xl border border-gray-700 bg-gray-800 p-5">
            <div className="mb-2 flex items-center gap-2">
              <span className="text-lg">📖</span>
              <p className="font-semibold text-white">Adding words from a Surah</p>
            </div>
            <p className="leading-relaxed">
              When you browse a surah and select a word, it gets added to your{" "}
              <strong className="text-white">single shared deck</strong> — one deck for the entire Quran.
              If the same word appears in multiple surahs, you only learn it once.
              Once a word is in your deck, it won&apos;t show up as &quot;new&quot; again no matter which surah you visit next.
            </p>
          </div>

          <div className="rounded-xl border border-gray-700 bg-gray-800 p-5">
            <div className="mb-2 flex items-center gap-2">
              <span className="text-lg">🔄</span>
              <p className="font-semibold text-white">Reviewing a card</p>
            </div>
            <p className="mb-3 leading-relaxed">
              Each card shows the Arabic word on the front. Click the card (or press{" "}
              <kbd className="rounded border border-gray-600 bg-gray-700 px-1.5 py-0.5 text-xs text-gray-200">Space</kbd>
              ) to flip it and see the meaning, root, verb forms, and examples. After flipping, rate
              how well you remembered it — the app uses your rating to decide when to show you the card next.
            </p>
            <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
              <div className="rounded-lg bg-red-500/10 p-3">
                <div className="mb-1 font-bold text-red-400">Again</div>
                <div className="text-gray-400">Completely forgot — you&apos;ll see it again soon in this session</div>
              </div>
              <div className="rounded-lg bg-orange-500/10 p-3">
                <div className="mb-1 font-bold text-orange-400">Hard</div>
                <div className="text-gray-400">Recalled with difficulty — shorter gap before next review</div>
              </div>
              <div className="rounded-lg bg-emerald-500/10 p-3">
                <div className="mb-1 font-bold text-emerald-400">Good</div>
                <div className="text-gray-400">Got it — normal interval, you&apos;ll see it in a few days</div>
              </div>
              <div className="rounded-lg bg-blue-500/10 p-3">
                <div className="mb-1 font-bold text-blue-400">Easy</div>
                <div className="text-gray-400">Instant recall — long gap, you clearly know this one</div>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-teal-500/20 bg-teal-500/5 p-5">
            <div className="mb-2 flex items-center gap-2">
              <span className="text-lg">📜</span>
              <p className="font-semibold text-white">Muyassar Gharib</p>
            </div>
            <p className="leading-relaxed">
              <em className="text-teal-400">Al-Muyassar fi Gharib Al-Quran</em> is a classical Arabic
              scholarly work that explains the meaning of &quot;gharib&quot; (unfamiliar or rare) words in the
              Quran — in Arabic. When enabled on the review card, it shows the scholar&apos;s explanation
              of exactly how that word is used <strong className="text-white">in its specific Quranic context</strong>,
              not just the dictionary meaning. Think of it as a mini-tafsir focused on vocabulary.
              It&apos;s shown in Arabic, so it&apos;s most useful if you have some Arabic reading ability.
            </p>
          </div>

          <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-5">
            <div className="mb-2 flex items-center gap-2">
              <span className="text-lg">📚</span>
              <p className="font-semibold text-white">Hans Wehr Dictionary</p>
            </div>
            <p className="leading-relaxed">
              The <em className="text-amber-400">Hans Wehr Dictionary of Modern Written Arabic</em> is
              one of the most comprehensive Arabic-English dictionaries ever compiled. When enabled, the
              review card pulls the full dictionary entry for the word&apos;s root — showing all derived forms,
              verb patterns (Form II, III, IV…), and the range of meanings the root can carry. Great for
              deepening your understanding beyond the primary translation.
            </p>
          </div>
        </div>
      ),
    },
    {
      title: "A note on Arabic morphology",
      subtitle: "Why basic Sarf knowledge makes a huge difference",
      content: (
        <div className="text-sm text-gray-300">
          <div className="rounded-xl border border-purple-500/20 bg-purple-500/5 p-5">
            <div className="mb-3 flex items-center gap-2">
              <span className="text-lg">🔤</span>
              <p className="font-semibold text-white">Basic Sarf knowledge helps</p>
            </div>
            <p className="mb-4 leading-relaxed">
              Many morphological duplicates — different conjugated or inflected forms of the same root —
              were intentionally left out of the deck to avoid redundancy. This means a basic familiarity
              with <strong className="text-white">Sarf</strong> (Arabic morphology), particularly verb
              tables, will significantly help you get full value from what you learn here.
            </p>
            <div className="rounded-lg border border-purple-500/20 bg-purple-950/30 p-4 mb-4">
              <p className="mb-3 text-xs font-medium text-purple-300">Example — root ح س ن (to be good / to do good)</p>
              <div dir="rtl" className="font-amiri text-xl text-white leading-loose mb-3">
                إِحْسَان — مُحْسِن — مُحْسِنِين — مُحْسِنُون — أَحْسَنَ — يُحْسِنُ — أَحْسِنْ
              </div>
              <div className="space-y-1 text-xs text-gray-400">
                <div><span className="text-purple-300">Ihsan</span> — excellence / doing good (verbal noun)</div>
                <div><span className="text-purple-300">Muhsin</span> — one who does good (active participle)</div>
                <div><span className="text-purple-300">Muhsineen / Muhsinoon</span> — those who do good (accusative / nominative)</div>
                <div><span className="text-purple-300">Ahsana</span> — he did good (past tense)</div>
                <div><span className="text-purple-300">Yuhsinu</span> — he does good (present tense)</div>
                <div><span className="text-purple-300">Ahsin</span> — do good! (imperative)</div>
              </div>
            </div>
            <p className="leading-relaxed">
              Without knowledge of Sarf, each of these looks like a completely separate word — that is{" "}
              <strong className="text-white">7× the effort</strong> for what is really one root with one
              core meaning. With even a basic grasp of verb tables and pattern recognition, you learn
              the root once and instantly recognise all its forms across the Quran. It is therefore{" "}
              <strong className="text-white">strongly recommended</strong> to study foundational Arabic
              grammar alongside this app to learn as efficiently as possible.
            </p>
          </div>
        </div>
      ),
    },
    {
      title: "Your responsibility",
      subtitle: "Please read before you start memorising",
      content: (
        <div className="text-sm text-gray-300">
          <div className="rounded-xl border border-rose-500/30 bg-rose-500/5 p-5">
            <div className="mb-3 flex items-center gap-2">
              <span className="text-lg">⚠️</span>
              <p className="font-semibold text-white">Translations may not always be perfect</p>
            </div>
            <p className="mb-4 text-base font-semibold text-rose-300 leading-snug">
              It is your responsibility to verify the meanings you are memorizing before committing them to memory.
            </p>
            <p className="mb-4 leading-relaxed">
              The primary translations shown on the cards are sourced from the{" "}
              <strong className="text-white">Quranic Corpus</strong> — linguistic word-level annotations
              that may occasionally be oversimplified or miss important nuance. If something looks wrong,
              please flag it so it can be corrected for everyone.
            </p>
            <p className="leading-relaxed text-gray-400">
              For the most reliable understanding of a word, treat{" "}
              <strong className="text-teal-400">Muyassar Gharib</strong> as the authority on what a word
              means <em>in its specific Quranic context</em>, and{" "}
              <strong className="text-amber-400">Hans Wehr</strong> as the authority on its broader
              Arabic meaning and usage. These are the sources to trust when the primary translation
              seems off.
            </p>
          </div>
        </div>
      ),
    },
  ];

  const current = pages[page];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm px-4 py-8">
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col rounded-2xl border border-gray-700 bg-gray-900 shadow-2xl">
        {/* Header */}
        <div className="shrink-0 px-8 pb-4 pt-8">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex gap-1.5">
              {pages.map((_, i) => (
                <div
                  key={i}
                  className={`h-1.5 rounded-full transition-all duration-300 ${
                    i === page
                      ? "w-8 bg-emerald-500"
                      : i < page
                      ? "w-8 bg-emerald-800"
                      : "w-8 bg-gray-700"
                  }`}
                />
              ))}
            </div>
            <span className="text-xs text-gray-500">
              {page + 1} / {totalPages}
            </span>
          </div>
          <h2 className="mb-1 text-2xl font-bold text-white">{current.title}</h2>
          <p className="text-sm text-gray-500">{current.subtitle}</p>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto px-8 py-2">{current.content}</div>

        {/* Footer */}
        <div className="shrink-0 px-8 pb-8 pt-4">
          {page < totalPages - 1 ? (
            <button
              onClick={() => setPage((p) => p + 1)}
              className="w-full rounded-xl bg-emerald-600 px-6 py-3 font-semibold text-white transition-all hover:bg-emerald-500"
            >
              Next →
            </button>
          ) : (
            <button
              onClick={onClose}
              className="w-full rounded-xl bg-emerald-600 px-6 py-3 font-semibold text-white transition-all hover:bg-emerald-500"
            >
              Got it
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

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

function calculateStreak(reviews: ReviewLogEntry[]): number {
  if (reviews.length === 0) return 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const reviewedDays = new Set(
    reviews.map((r) => {
      const d = new Date(r.timestamp);
      d.setHours(0, 0, 0, 0);
      return d.getTime();
    })
  );

  // Check if reviewed today or yesterday (grace: streak survives until end of next day)
  let streak = 0;
  let cursor = today.getTime();

  // Allow streak if today has reviews, or if yesterday had reviews (today not done yet)
  if (!reviewedDays.has(cursor)) {
    cursor -= 86400000; // check yesterday
    if (!reviewedDays.has(cursor)) return 0;
  }

  while (reviewedDays.has(cursor)) {
    streak++;
    cursor -= 86400000;
  }
  return streak;
}

export default function FlashcardsHubPage() {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const [dueCount, setDueCount] = useState(0);
  const [newCount, setNewCount] = useState(0);
  const [totalCards, setTotalCards] = useState(0);
  const [streak, setStreak] = useState(0);
  const [loading, setLoading] = useState(true);
  const [addingDemo, setAddingDemo] = useState(false);
  const [showSRExplainer, setShowSRExplainer] = useState(false);
  const [showHowItWorks, setShowHowItWorks] = useState(false);

  useEffect(() => {
    async function initializeAndLoad() {
      await migrateFromLocalStorage();
      await loadStats();
    }
    initializeAndLoad();
  }, []);

  async function loadStats() {
    const [due, newCards, cards, reviews] = await Promise.all([
      getDueCardsCount(),
      getNewCardsCount(),
      getFlashcards(),
      getReviewLog(),
    ]);
    setDueCount(due);
    setNewCount(newCards);
    setTotalCards(cards.length);
    setStreak(calculateStreak(reviews));
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
      {showHowItWorks && <HowItWorksModal onClose={() => setShowHowItWorks(false)} />}
      <div className="mx-auto max-w-4xl">
        {!authLoading && !isAuthenticated && (
          <div className="mb-6 flex items-center gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-300">
            <span>⚠️</span>
            <span>
              Your progress is saved on this device only.{" "}
              <Link href="/api/auth/qf/login" className="underline hover:text-amber-200">
                Sign in
              </Link>{" "}
              to sync across devices.
            </span>
          </div>
        )}
        <div className="mb-12 text-center">
          <h1 className="mb-3 text-4xl font-bold text-white">
            Ready to learn?
          </h1>
          <p className="mb-4 text-gray-400">
            Master Quranic vocabulary with spaced repetition
          </p>
          <div className="mb-4 flex items-center justify-center gap-3">
            {streak > 0 && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-orange-500/40 bg-orange-500/10 px-4 py-1.5 text-sm font-semibold text-orange-400">
                🔥 {streak} day streak
              </span>
            )}
            <button
              onClick={() => setShowSRExplainer(true)}
              className="inline-flex items-center gap-2 rounded-full border border-gray-700 bg-gray-800/60 px-4 py-1.5 text-xs text-gray-400 transition-all hover:border-emerald-500/50 hover:text-emerald-400"
            >
              <span className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-current text-[10px] font-bold">i</span>
              What is spaced repetition?
            </button>
          </div>
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
              You haven&apos;t added any words yet. Select a surah to begin learning!
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

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
            href="/train/flashcards/browse"
            className="flex items-center gap-3 rounded-xl border border-gray-800 bg-gray-900 p-4 transition-all hover:border-gray-700 hover:bg-gray-800"
          >
            <div className="text-2xl">🗂️</div>
            <div>
              <div className="font-medium text-white">Browse Deck</div>
              <div className="text-sm text-gray-500">View all your cards</div>
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

        <div className="mt-8 flex justify-center">
          <button
            onClick={() => setShowHowItWorks(true)}
            className="inline-flex items-center gap-2 rounded-full border border-gray-700 bg-gray-800/60 px-5 py-2 text-sm text-gray-400 transition-all hover:border-gray-600 hover:text-gray-300"
          >
            <span className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-current text-[10px] font-bold">i</span>
            How does this work?
          </button>
        </div>
      </div>
    </div>
  );
}
