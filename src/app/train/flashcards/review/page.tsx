"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { FlashcardReview } from "@/components/flashcard/FlashcardReview";
import type { FlashcardSession, Rating, FSRSCard } from "@/lib/types/flashcard";
import {
  createReviewSession,
  reviewCard,
  undoReview,
  getCurrentCard,
  isSessionComplete,
  getSessionProgress,
} from "@/lib/flashcard/session-manager";
import { getWordById } from "@/lib/corpus/lexical-db";
import { deleteFlashcard } from "@/lib/storage/flashcard-storage-supabase";

// ── Flagged words (localStorage) ─────────────────────────────────
const FLAGGED_KEY = "qalamspace_flagged_words";

function getFlaggedWords(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = localStorage.getItem(FLAGGED_KEY);
    return raw ? new Set(JSON.parse(raw) as string[]) : new Set();
  } catch {
    return new Set();
  }
}

function saveFlaggedWords(set: Set<string>): void {
  localStorage.setItem(FLAGGED_KEY, JSON.stringify([...set]));
}

// ── Undo snapshot type ───────────────────────────────────────────
interface UndoEntry {
  session: FlashcardSession;
  cardId: string;
  prevFsrsState: FSRSCard;
  logId: string;
}

export default function ReviewPage() {
  const router = useRouter();
  const [session, setSession] = useState<FlashcardSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [showSummary, setShowSummary] = useState(false);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [currentWord, setCurrentWord] = useState<any>(null);
  const [showHansWehr, setShowHansWehr] = useState(false);
  const [showMuyassar, setShowMuyassar] = useState(false);
  const [muyassarAvailable, setMuyassarAvailable] = useState(false);
  const [undoStack, setUndoStack] = useState<UndoEntry[]>([]);
  const [flaggedWords, setFlaggedWords] = useState<Set<string>>(new Set());
  const [justFlagged, setJustFlagged] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    setFlaggedWords(getFlaggedWords());
  }, []);

  useEffect(() => {
    async function initSession() {
      const newSession = await createReviewSession();
      if (!newSession) {
        router.push("/train/flashcards");
        return;
      }
      setSession(newSession);
      setLoading(false);
    }
    initSession();
  }, [router]);

  useEffect(() => {
    if (!session || showSummary) return;
    const interval = setInterval(() => {
      setElapsedTime(Date.now() - session.start_time.getTime());
    }, 1000);
    return () => clearInterval(interval);
  }, [session, showSummary]);

  useEffect(() => {
    async function loadWord() {
      if (!session) { setCurrentWord(null); return; }
      const card = getCurrentCard(session);
      if (card) {
        setMuyassarAvailable(false);
        const word = await getWordById(card.word_id);
        if (word) setCurrentWord(word);
        else console.error(`Word not found for id: ${card.word_id}`);
      } else {
        setCurrentWord(null);
      }
    }
    loadWord();
  }, [session]);

  const handleReview = async (rating: Rating, durationMs: number) => {
    if (!session) return;
    const card = getCurrentCard(session);
    if (!card) return;

    const undoEntry: UndoEntry = {
      session,
      cardId: card.id,
      prevFsrsState: { ...card.fsrs_state },
      logId: "",
    };

    const { updatedSession, logId } = await reviewCard(session, card.id, rating, durationMs);
    undoEntry.logId = logId;
    setUndoStack((prev) => [...prev.slice(-9), undoEntry]);

    if (isSessionComplete(updatedSession)) setShowSummary(true);
    setSession(updatedSession);
  };

  const handleUndo = async () => {
    const last = undoStack[undoStack.length - 1];
    if (!last) return;
    await undoReview(last.cardId, last.prevFsrsState, last.logId);
    setUndoStack((prev) => prev.slice(0, -1));
    setSession(last.session);
    setShowSummary(false);
  };

  const handleFlag = () => {
    if (!session) return;
    const card = getCurrentCard(session);
    if (!card) return;
    const updated = new Set(flaggedWords);
    if (updated.has(card.word_id)) {
      updated.delete(card.word_id);
    } else {
      updated.add(card.word_id);
      setJustFlagged(true);
      setTimeout(() => setJustFlagged(false), 1500);
    }
    setFlaggedWords(updated);
    saveFlaggedWords(updated);
  };

  const handleDelete = async () => {
    if (!session) return;
    const card = getCurrentCard(session);
    if (!card) return;
    await deleteFlashcard(card.id);
    // Remove card from session queue and keep current_index pointing at the next card
    const updatedCards = session.cards.filter((_, i) => i !== session.current_index);
    const updatedSession = {
      ...session,
      cards: updatedCards,
      stats: { ...session.stats, total_cards: Math.max(0, session.stats.total_cards - 1) },
    };
    setUndoStack([]); // undo would be invalid after a delete
    setConfirmDelete(false);
    setMenuOpen(false);
    if (updatedSession.current_index >= updatedCards.length) {
      setShowSummary(true);
    }
    setSession(updatedSession);
  };

  const formatTime = (ms: number) => {
    const s = Math.floor(ms / 1000);
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-950">
        <div className="text-center">
          <div className="mb-4 h-12 w-12 animate-spin rounded-full border-4 border-emerald-500 border-t-transparent" />
          <p className="text-gray-400">Loading your review session...</p>
        </div>
      </div>
    );
  }

  if (!session) return null;

  const progress = getSessionProgress(session);
  const currentCard = getCurrentCard(session);
  const isFlagged = flaggedWords.has(currentCard?.word_id ?? "");

  if (showSummary) {
    return (
      <div className="min-h-screen bg-gray-950 px-4 py-12">
        <div className="mx-auto max-w-2xl">
          <div className="mb-8 text-center">
            <div className="mb-4 text-6xl">🎉</div>
            <h1 className="mb-2 text-3xl font-bold text-white">Session Complete!</h1>
            <p className="text-gray-400">Great work on your review session</p>
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-2xl border border-gray-800 bg-gray-900 p-6">
                <div className="mb-2 text-sm text-gray-500">Cards Reviewed</div>
                <div className="text-3xl font-bold text-white">{session.stats.cards_reviewed}</div>
              </div>
              <div className="rounded-2xl border border-gray-800 bg-gray-900 p-6">
                <div className="mb-2 text-sm text-gray-500">Time Spent</div>
                <div className="text-3xl font-bold text-white">{formatTime(session.stats.total_time_ms)}</div>
              </div>
            </div>

            <div className="rounded-2xl border border-gray-800 bg-gray-900 p-6">
              <div className="mb-4 text-sm text-gray-500">Performance</div>
              <div className="grid grid-cols-4 gap-2 text-center">
                <div>
                  <div className="mb-1 text-2xl font-bold text-red-400">{session.stats.again_count}</div>
                  <div className="text-xs text-gray-500">Again</div>
                </div>
                <div>
                  <div className="mb-1 text-2xl font-bold text-orange-400">{session.stats.hard_count}</div>
                  <div className="text-xs text-gray-500">Hard</div>
                </div>
                <div>
                  <div className="mb-1 text-2xl font-bold text-emerald-400">{session.stats.good_count}</div>
                  <div className="text-xs text-gray-500">Good</div>
                </div>
                <div>
                  <div className="mb-1 text-2xl font-bold text-blue-400">{session.stats.easy_count}</div>
                  <div className="text-xs text-gray-500">Easy</div>
                </div>
              </div>
            </div>

            {flaggedWords.size > 0 && (
              <div className="rounded-2xl border border-yellow-800/40 bg-yellow-950/30 p-4 text-sm text-yellow-300">
                ⚑ {flaggedWords.size} word{flaggedWords.size !== 1 ? "s" : ""} flagged for translation review
              </div>
            )}

            <button
              onClick={() => router.push("/train/flashcards")}
              className="w-full rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-700 px-6 py-4 font-semibold text-white shadow-lg transition-all hover:scale-105 hover:shadow-xl"
            >
              Continue
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 px-4 py-8" onClick={() => { setMenuOpen(false); setConfirmDelete(false); }}>
      <div className="mx-auto max-w-4xl">
        {/* Progress */}
        <div className="mb-6">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm text-gray-400">{progress.current} / {progress.total} cards</span>
            <span className="text-sm text-gray-400">{formatTime(elapsedTime)}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-gray-800">
            <div
              className="h-full bg-gradient-to-r from-emerald-500 to-emerald-600 transition-all duration-300"
              style={{ width: `${progress.percentage}%` }}
            />
          </div>
        </div>

        {/* Controls row */}
        <div className="mb-4 flex items-center justify-between gap-3">
          {/* Left: Undo + 3-dot menu */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleUndo}
              disabled={undoStack.length === 0}
              title="Undo last rating (Z)"
              className="flex items-center gap-1.5 rounded-lg border border-gray-700 bg-gray-900 px-3 py-1.5 text-sm text-gray-500 transition-colors hover:border-gray-600 hover:text-gray-300 disabled:cursor-not-allowed disabled:opacity-30"
            >
              <span className="text-base leading-none">↩</span>
              <span>Undo</span>
            </button>

            {/* 3-dot menu */}
            <div className="relative">
              <button
                onClick={(e) => { e.stopPropagation(); setMenuOpen((v) => !v); setConfirmDelete(false); }}
                title="Card options"
                className="flex items-center justify-center rounded-lg border border-gray-700 bg-gray-900 px-2.5 py-1.5 text-gray-500 transition-colors hover:border-gray-600 hover:text-gray-300"
              >
                <span className="text-base leading-none tracking-widest">•••</span>
              </button>

              {menuOpen && (
                <div
                  className="absolute left-0 top-full z-20 mt-1 min-w-[160px] rounded-xl border border-gray-700 bg-gray-900 py-1 shadow-xl"
                  onClick={(e) => e.stopPropagation()}
                >
                  {confirmDelete ? (
                    <div className="px-3 py-2">
                      <p className="mb-2 text-xs text-gray-400">Remove this card permanently?</p>
                      <div className="flex gap-2">
                        <button
                          onClick={handleDelete}
                          className="flex-1 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-red-500"
                        >
                          Delete
                        </button>
                        <button
                          onClick={() => { setConfirmDelete(false); setMenuOpen(false); }}
                          className="flex-1 rounded-lg bg-gray-800 px-3 py-1.5 text-xs font-medium text-gray-300 transition-colors hover:bg-gray-700"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => setConfirmDelete(true)}
                      className="flex w-full items-center gap-2 px-4 py-2 text-sm text-red-400 transition-colors hover:bg-red-500/10"
                    >
                      <span>🗑</span>
                      <span>Delete card</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Flag button */}
            <button
              onClick={handleFlag}
              title="Flag word as incorrect translation"
              className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm transition-colors ${
                isFlagged
                  ? "border-yellow-500/50 bg-yellow-500/10 text-yellow-400"
                  : "border-gray-700 bg-gray-900 text-gray-500 hover:border-yellow-500/40 hover:text-yellow-400"
              }`}
            >
              <span>{isFlagged ? "⚑" : "⚐"}</span>
              <span>{justFlagged ? "Flagged!" : isFlagged ? "Flagged" : "Flag"}</span>
            </button>

            {/* Hans Wehr toggle */}
            <button
              onClick={() => setShowHansWehr((prev) => !prev)}
              className={`flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm transition-colors ${
                showHansWehr
                  ? "border-amber-500/50 bg-amber-500/10 text-amber-400"
                  : "border-gray-700 bg-gray-900 text-gray-500 hover:text-gray-300"
              }`}
            >
              <span>Hans Wehr</span>
              <span className={`relative h-4 w-7 rounded-full transition-colors ${showHansWehr ? "bg-amber-500" : "bg-gray-700"}`}>
                <span className={`absolute top-0.5 h-3 w-3 rounded-full bg-white transition-all duration-200 ${showHansWehr ? "left-3.5" : "left-0.5"}`} />
              </span>
            </button>

            {/* Muyassar Gharib toggle — only shown when current word has a single-word entry */}
            {muyassarAvailable && (
              <button
                onClick={() => setShowMuyassar((prev) => !prev)}
                className={`flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm transition-colors ${
                  showMuyassar
                    ? "border-teal-500/50 bg-teal-500/10 text-teal-400"
                    : "border-gray-700 bg-gray-900 text-gray-500 hover:text-gray-300"
                }`}
              >
                <span>Muyassar</span>
                <span className={`relative h-4 w-7 rounded-full transition-colors ${showMuyassar ? "bg-teal-500" : "bg-gray-700"}`}>
                  <span className={`absolute top-0.5 h-3 w-3 rounded-full bg-white transition-all duration-200 ${showMuyassar ? "left-3.5" : "left-0.5"}`} />
                </span>
              </button>
            )}
          </div>
        </div>

        {/* Card */}
        <div className="mb-6 flex items-center justify-center">
          {currentWord ? (
            <FlashcardReview
              word={currentWord}
              onReview={handleReview}
              showRoot={true}
              showExamples={true}
              showHansWehr={showHansWehr}
              showMuyassar={showMuyassar}
              onMuyassarAvailable={setMuyassarAvailable}
            />
          ) : (
            <div className="text-center text-gray-400">No more cards to review</div>
          )}
        </div>

        {/* Desktop session stats */}
        <div className="fixed right-4 top-20 hidden rounded-2xl border border-gray-800 bg-gray-900/95 p-4 backdrop-blur-sm lg:block">
          <div className="mb-4 text-sm font-medium text-gray-400">Session Stats</div>
          <div className="space-y-3">
            <div>
              <div className="text-xs text-gray-500">New Cards</div>
              <div className="text-lg font-bold text-blue-400">{session.stats.new_cards}</div>
            </div>
            <div>
              <div className="text-xs text-gray-500">Review Cards</div>
              <div className="text-lg font-bold text-purple-400">{session.stats.review_cards}</div>
            </div>
            <div>
              <div className="text-xs text-gray-500">Reviewed</div>
              <div className="text-lg font-bold text-emerald-400">{session.stats.cards_reviewed}</div>
            </div>
            {flaggedWords.size > 0 && (
              <div>
                <div className="text-xs text-gray-500">Flagged</div>
                <div className="text-lg font-bold text-yellow-400">{flaggedWords.size}</div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
