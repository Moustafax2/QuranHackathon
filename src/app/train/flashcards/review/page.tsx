"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { FlashcardReview } from "@/components/flashcard/FlashcardReview";
import type { FlashcardSession, Rating } from "@/lib/types/flashcard";
import {
  createReviewSession,
  reviewCard,
  getCurrentCard,
  isSessionComplete,
  getSessionProgress,
  getSessionSummary,
} from "@/lib/flashcard/session-manager";
import { getWordById } from "@/lib/corpus/lexical-db";

export default function ReviewPage() {
  const router = useRouter();
  const [session, setSession] = useState<FlashcardSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [showSummary, setShowSummary] = useState(false);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [currentWord, setCurrentWord] = useState<any>(null);
  const [showHansWehr, setShowHansWehr] = useState(false);

  useEffect(() => {
    async function initSession() {
      // #region agent log
      fetch('http://127.0.0.1:7416/ingest/1edaefa5-f6b3-407e-a724-c5352cdc9880',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'b6417a'},body:JSON.stringify({sessionId:'b6417a',location:'review/page.tsx:27',message:'initSession called',data:{},timestamp:Date.now(),hypothesisId:'B'})}).catch(()=>{});
      // #endregion
      const newSession = await createReviewSession();
      // #region agent log
      fetch('http://127.0.0.1:7416/ingest/1edaefa5-f6b3-407e-a724-c5352cdc9880',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'b6417a'},body:JSON.stringify({sessionId:'b6417a',location:'review/page.tsx:32',message:'createReviewSession result',data:{hasSession:!!newSession,sessionId:newSession?.id,cardsCount:newSession?.cards.length},timestamp:Date.now(),hypothesisId:'B'})}).catch(()=>{});
      // #endregion
      if (!newSession) {
        // #region agent log
        fetch('http://127.0.0.1:7416/ingest/1edaefa5-f6b3-407e-a724-c5352cdc9880',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'b6417a'},body:JSON.stringify({sessionId:'b6417a',location:'review/page.tsx:37',message:'No session - redirecting',data:{},timestamp:Date.now(),hypothesisId:'B'})}).catch(()=>{});
        // #endregion
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
      const elapsed = Date.now() - session.start_time.getTime();
      setElapsedTime(elapsed);
    }, 1000);

    return () => clearInterval(interval);
  }, [session, showSummary]);

  useEffect(() => {
    async function loadWord() {
      if (!session) {
        setCurrentWord(null);
        return;
      }

      const currentCard = getCurrentCard(session);
      // #region agent log
      fetch('http://127.0.0.1:7416/ingest/1edaefa5-f6b3-407e-a724-c5352cdc9880',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'b6417a'},body:JSON.stringify({sessionId:'b6417a',location:'review/page.tsx:58',message:'getCurrentCard result',data:{hasCard:!!currentCard,cardId:currentCard?.id,wordId:currentCard?.word_id,currentIndex:session.current_index,totalCards:session.cards.length},timestamp:Date.now(),hypothesisId:'D,E'})}).catch(()=>{});
      // #endregion
      if (currentCard) {
        const word = await getWordById(currentCard.word_id);
        // #region agent log
        fetch('http://127.0.0.1:7416/ingest/1edaefa5-f6b3-407e-a724-c5352cdc9880',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'b6417a'},body:JSON.stringify({sessionId:'b6417a',location:'review/page.tsx:64',message:'getWordById result',data:{hasWord:!!word,wordId:currentCard.word_id},timestamp:Date.now(),hypothesisId:'E'})}).catch(()=>{});
        // #endregion
        if (word) {
          setCurrentWord(word);
        } else {
          console.error(`Word not found in lexical DB for id: ${currentCard.word_id}`);
        }
      } else {
        setCurrentWord(null);
      }
    }
    loadWord();
  }, [session]);

  const handleReview = async (rating: Rating, durationMs: number) => {
    if (!session) return;

    const currentCard = getCurrentCard(session);
    if (!currentCard) return;

    const updatedSession = await reviewCard(
      session,
      currentCard.id,
      rating,
      durationMs
    );

    if (isSessionComplete(updatedSession)) {
      setShowSummary(true);
    }

    setSession(updatedSession);
  };

  const formatTime = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-950">
        <div className="text-center">
          <div className="mb-4 h-12 w-12 animate-spin rounded-full border-4 border-emerald-500 border-t-transparent"></div>
          <p className="text-gray-400">Loading your review session...</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return null;
  }

  const progress = getSessionProgress(session);
  const currentCard = getCurrentCard(session);

  if (showSummary) {
    return (
      <div className="min-h-screen bg-gray-950 px-4 py-12">
        <div className="mx-auto max-w-2xl">
          <div className="mb-8 text-center">
            <div className="mb-4 text-6xl">🎉</div>
            <h1 className="mb-2 text-3xl font-bold text-white">
              Session Complete!
            </h1>
            <p className="text-gray-400">Great work on your review session</p>
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-2xl border border-gray-800 bg-gray-900 p-6">
                <div className="mb-2 text-sm text-gray-500">Cards Reviewed</div>
                <div className="text-3xl font-bold text-white">
                  {session.stats.cards_reviewed}
                </div>
              </div>
              <div className="rounded-2xl border border-gray-800 bg-gray-900 p-6">
                <div className="mb-2 text-sm text-gray-500">Time Spent</div>
                <div className="text-3xl font-bold text-white">
                  {formatTime(session.stats.total_time_ms)}
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-gray-800 bg-gray-900 p-6">
              <div className="mb-4 text-sm text-gray-500">Performance</div>
              <div className="grid grid-cols-4 gap-2">
                <div className="text-center">
                  <div className="mb-1 text-2xl font-bold text-red-400">
                    {session.stats.again_count}
                  </div>
                  <div className="text-xs text-gray-500">Again</div>
                </div>
                <div className="text-center">
                  <div className="mb-1 text-2xl font-bold text-orange-400">
                    {session.stats.hard_count}
                  </div>
                  <div className="text-xs text-gray-500">Hard</div>
                </div>
                <div className="text-center">
                  <div className="mb-1 text-2xl font-bold text-emerald-400">
                    {session.stats.good_count}
                  </div>
                  <div className="text-xs text-gray-500">Good</div>
                </div>
                <div className="text-center">
                  <div className="mb-1 text-2xl font-bold text-blue-400">
                    {session.stats.easy_count}
                  </div>
                  <div className="text-xs text-gray-500">Easy</div>
                </div>
              </div>
            </div>

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
    <div className="min-h-screen bg-gray-950 px-4 py-8">
      <div className="mx-auto max-w-4xl">
        <div className="mb-6">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm text-gray-400">
              {progress.current} / {progress.total} cards
            </span>
            <span className="text-sm text-gray-400">
              {formatTime(elapsedTime)}
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-gray-800">
            <div
              className="h-full bg-gradient-to-r from-emerald-500 to-emerald-600 transition-all duration-300"
              style={{ width: `${progress.percentage}%` }}
            />
          </div>
        </div>

        <div className="mb-4 flex items-center justify-end">
          <button
            onClick={() => setShowHansWehr((prev) => !prev)}
            className={`flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm transition-colors ${
              showHansWehr
                ? "border-amber-500/50 bg-amber-500/10 text-amber-400"
                : "border-gray-700 bg-gray-900 text-gray-500 hover:text-gray-300"
            }`}
          >
            <span>Hans Wehr</span>
            <span
              className={`h-4 w-7 rounded-full transition-colors ${
                showHansWehr ? "bg-amber-500" : "bg-gray-700"
              } relative`}
            >
              <span
                className={`absolute top-0.5 h-3 w-3 rounded-full bg-white transition-transform ${
                  showHansWehr ? "translate-x-3.5" : "translate-x-0.5"
                }`}
              />
            </span>
          </button>
        </div>

        <div className="mb-6 flex items-center justify-center">
          {currentWord ? (
            <FlashcardReview
              word={currentWord}
              onReview={handleReview}
              showRoot={true}
              showExamples={true}
              showHansWehr={showHansWehr}
            />
          ) : (
            <div className="text-center text-gray-400">
              No more cards to review
            </div>
          )}
        </div>

        <div className="fixed right-4 top-20 hidden rounded-2xl border border-gray-800 bg-gray-900/95 p-4 backdrop-blur-sm lg:block">
          <div className="mb-4 text-sm font-medium text-gray-400">
            Session Stats
          </div>
          <div className="space-y-3">
            <div>
              <div className="text-xs text-gray-500">New Cards</div>
              <div className="text-lg font-bold text-blue-400">
                {session.stats.new_cards}
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-500">Review Cards</div>
              <div className="text-lg font-bold text-purple-400">
                {session.stats.review_cards}
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-500">Reviewed</div>
              <div className="text-lg font-bold text-emerald-400">
                {session.stats.cards_reviewed}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
