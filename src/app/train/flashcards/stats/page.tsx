"use client";

import { useEffect, useState } from "react";
import { getFlashcards, getReviewLog } from "@/lib/storage/flashcard-storage-supabase";
import { FSRSState } from "@/lib/types/flashcard";
import type { UserFlashcard, ReviewLogEntry } from "@/lib/types/flashcard";

export default function StatsPage() {
  const [cards, setCards] = useState<UserFlashcard[]>([]);
  const [reviews, setReviews] = useState<ReviewLogEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      const [flashcards, reviewLog] = await Promise.all([
        getFlashcards(),
        getReviewLog(),
      ]);
      setCards(flashcards);
      setReviews(reviewLog);
      setLoading(false);
    }
    loadData();
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-950">
        <div className="text-center">
          <div className="mb-4 h-12 w-12 animate-spin rounded-full border-4 border-emerald-500 border-t-transparent"></div>
          <p className="text-gray-400">Loading statistics...</p>
        </div>
      </div>
    );
  }

  const totalWords = cards.length;
  const newCards = cards.filter((c) => c.fsrs_state.state === FSRSState.New).length;
  const learningCards = cards.filter(
    (c) =>
      c.fsrs_state.state === FSRSState.Learning ||
      c.fsrs_state.state === FSRSState.Relearning
  ).length;
  const matureCards = cards.filter(
    (c) => c.fsrs_state.state === FSRSState.Review && c.fsrs_state.stability >= 21
  ).length;

  const totalReviews = reviews.length;
  const thisWeekReviews = reviews.filter((r) => {
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    return r.timestamp >= weekAgo;
  }).length;

  const totalStudyTime = reviews.reduce(
    (sum, r) => sum + (r.review_duration_ms || 0),
    0
  );
  const avgReviewTime =
    totalReviews > 0 ? totalStudyTime / totalReviews : 0;

  const goodReviews = reviews.filter((r) => r.rating >= 3).length;
  const retentionRate =
    totalReviews > 0 ? (goodReviews / totalReviews) * 100 : 0;

  const formatTime = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    }
    return `${minutes}m ${seconds % 60}s`;
  };

  return (
    <div className="min-h-screen bg-gray-950 px-4 py-12">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8">
          <h1 className="mb-2 text-3xl font-bold text-white">Statistics</h1>
          <p className="text-gray-400">Track your learning progress</p>
        </div>

        <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl border border-gray-800 bg-gradient-to-br from-emerald-900/20 to-emerald-950/20 p-6">
            <div className="mb-2 text-sm text-emerald-400">Total Words</div>
            <div className="text-4xl font-bold text-white">{totalWords}</div>
          </div>

          <div className="rounded-2xl border border-gray-800 bg-gradient-to-br from-blue-900/20 to-blue-950/20 p-6">
            <div className="mb-2 text-sm text-blue-400">Retention Rate</div>
            <div className="text-4xl font-bold text-white">
              {retentionRate.toFixed(0)}%
            </div>
          </div>

          <div className="rounded-2xl border border-gray-800 bg-gradient-to-br from-purple-900/20 to-purple-950/20 p-6">
            <div className="mb-2 text-sm text-purple-400">Total Reviews</div>
            <div className="text-4xl font-bold text-white">{totalReviews}</div>
          </div>

          <div className="rounded-2xl border border-gray-800 bg-gradient-to-br from-amber-900/20 to-amber-950/20 p-6">
            <div className="mb-2 text-sm text-amber-400">Study Time</div>
            <div className="text-4xl font-bold text-white">
              {formatTime(totalStudyTime)}
            </div>
          </div>
        </div>

        <div className="mb-8 grid gap-6 lg:grid-cols-2">
          <div className="rounded-2xl border border-gray-800 bg-gray-900 p-6">
            <h2 className="mb-4 text-lg font-semibold text-white">
              Word Status Breakdown
            </h2>
            <div className="space-y-3">
              <div>
                <div className="mb-1 flex items-center justify-between text-sm">
                  <span className="text-gray-400">New</span>
                  <span className="text-blue-400">{newCards}</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-gray-800">
                  <div
                    className="h-full bg-blue-500"
                    style={{
                      width: `${totalWords > 0 ? (newCards / totalWords) * 100 : 0}%`,
                    }}
                  />
                </div>
              </div>

              <div>
                <div className="mb-1 flex items-center justify-between text-sm">
                  <span className="text-gray-400">Learning</span>
                  <span className="text-emerald-400">{learningCards}</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-gray-800">
                  <div
                    className="h-full bg-emerald-500"
                    style={{
                      width: `${
                        totalWords > 0 ? (learningCards / totalWords) * 100 : 0
                      }%`,
                    }}
                  />
                </div>
              </div>

              <div>
                <div className="mb-1 flex items-center justify-between text-sm">
                  <span className="text-gray-400">Mature</span>
                  <span className="text-purple-400">{matureCards}</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-gray-800">
                  <div
                    className="h-full bg-purple-500"
                    style={{
                      width: `${
                        totalWords > 0 ? (matureCards / totalWords) * 100 : 0
                      }%`,
                    }}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-gray-800 bg-gray-900 p-6">
            <h2 className="mb-4 text-lg font-semibold text-white">
              Recent Activity
            </h2>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-gray-400">This week</span>
                <span className="text-emerald-400">{thisWeekReviews} reviews</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-400">Average time per card</span>
                <span className="text-emerald-400">
                  {formatTime(avgReviewTime)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-400">Success rate</span>
                <span className="text-emerald-400">
                  {retentionRate.toFixed(1)}%
                </span>
              </div>
            </div>
          </div>
        </div>

        {reviews.length > 0 && (
          <div className="rounded-2xl border border-gray-800 bg-gray-900 p-6">
            <h2 className="mb-4 text-lg font-semibold text-white">
              Recent Reviews
            </h2>
            <div className="space-y-2">
              {reviews.slice(-10).reverse().map((review) => (
                <div
                  key={review.id}
                  className="flex items-center justify-between rounded-lg border border-gray-800 bg-gray-950 p-3"
                >
                  <div className="text-sm text-gray-400">
                    {new Date(review.timestamp).toLocaleDateString()}
                  </div>
                  <div
                    className={`rounded px-2 py-1 text-xs font-medium ${
                      review.rating === 1
                        ? "bg-red-500/20 text-red-400"
                        : review.rating === 2
                        ? "bg-orange-500/20 text-orange-400"
                        : review.rating === 3
                        ? "bg-emerald-500/20 text-emerald-400"
                        : "bg-blue-500/20 text-blue-400"
                    }`}
                  >
                    {review.rating === 1
                      ? "Again"
                      : review.rating === 2
                      ? "Hard"
                      : review.rating === 3
                      ? "Good"
                      : "Easy"}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
