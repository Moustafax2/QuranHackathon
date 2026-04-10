"use client";

import { useEffect, useState } from "react";
import { getFlashcards, getReviewLog, getPreferences } from "@/lib/storage/flashcard-storage-supabase";
import { FSRSState } from "@/lib/types/flashcard";
import type { UserFlashcard, ReviewLogEntry, UserPreferences } from "@/lib/types/flashcard";

export default function StatsPage() {
  const [cards, setCards] = useState<UserFlashcard[]>([]);
  const [reviews, setReviews] = useState<ReviewLogEntry[]>([]);
  const [prefs, setPrefs] = useState<UserPreferences | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      const [flashcards, reviewLog, preferences] = await Promise.all([
        getFlashcards(),
        getReviewLog(),
        getPreferences(),
      ]);
      setCards(flashcards);
      setReviews(reviewLog);
      setPrefs(preferences);
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

  // ── Projections ──────────────────────────────────────────────
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  // 7-day forecast: how many cards are due each day
  const forecastDays = 7;
  const forecast = Array.from({ length: forecastDays }, (_, i) => {
    const dayStart = new Date(today);
    dayStart.setDate(today.getDate() + i);
    const dayEnd = new Date(dayStart);
    dayEnd.setDate(dayStart.getDate() + 1);
    const count = cards.filter((c) => {
      const due = new Date(c.fsrs_state.due);
      return due >= dayStart && due < dayEnd;
    }).length;
    return { label: i === 0 ? "Today" : i === 1 ? "Tomorrow" : `+${i}d`, count };
  });
  const forecastMax = Math.max(...forecast.map((d) => d.count), 1);

  // Reviews due in the next 30 days
  const in30Days = new Date(today);
  in30Days.setDate(today.getDate() + 30);
  const dueIn30 = cards.filter((c) => new Date(c.fsrs_state.due) < in30Days).length;

  // Days to introduce all remaining new cards
  const dailyNewLimit = prefs?.daily_new_cards_limit ?? 20;
  const newCards = cards.filter((c) => c.fsrs_state.state === FSRSState.New).length;
  const daysToLearnAll = newCards > 0 ? Math.ceil(newCards / dailyNewLimit) : 0;

  // Average interval of cards currently in Review state
  const reviewCards = cards.filter((c) => c.fsrs_state.state === FSRSState.Review);
  const avgInterval =
    reviewCards.length > 0
      ? Math.round(reviewCards.reduce((s, c) => s + c.fsrs_state.scheduled_days, 0) / reviewCards.length)
      : 0;

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

        {/* ── Review Heatmap ──────────────────────────────────── */}
        {(() => {
          const WEEKS = 52;
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          // Start from the Sunday of the week 52 weeks ago
          const startDay = new Date(today);
          startDay.setDate(today.getDate() - WEEKS * 7 + 1);

          // Count reviews per day
          const countByDay = new Map<string, number>();
          reviews.forEach((r) => {
            const d = new Date(r.timestamp);
            d.setHours(0, 0, 0, 0);
            const key = d.toISOString().slice(0, 10);
            countByDay.set(key, (countByDay.get(key) ?? 0) + 1);
          });

          const maxCount = Math.max(...Array.from(countByDay.values()), 1);

          // Build array of WEEKS*7 cells
          const cells: { date: Date; count: number }[] = [];
          for (let i = 0; i < WEEKS * 7; i++) {
            const d = new Date(startDay);
            d.setDate(startDay.getDate() + i);
            const key = d.toISOString().slice(0, 10);
            cells.push({ date: d, count: countByDay.get(key) ?? 0 });
          }

          // Colour levels: 0=empty, 1=light, 2=med, 3=dark, 4=full
          const colourClass = (count: number) => {
            if (count === 0) return "bg-gray-800";
            const pct = count / maxCount;
            if (pct < 0.25) return "bg-emerald-900";
            if (pct < 0.5)  return "bg-emerald-700";
            if (pct < 0.75) return "bg-emerald-500";
            return "bg-emerald-400";
          };

          // Group into columns (weeks)
          const weekColumns: typeof cells[] = [];
          for (let w = 0; w < WEEKS; w++) {
            weekColumns.push(cells.slice(w * 7, w * 7 + 7));
          }

          const monthLabels: { label: string; col: number }[] = [];
          weekColumns.forEach((week, wi) => {
            const firstOfWeek = week[0].date;
            if (firstOfWeek.getDate() <= 7) {
              monthLabels.push({
                label: firstOfWeek.toLocaleString("default", { month: "short" }),
                col: wi,
              });
            }
          });

          return (
            <div className="mb-8 rounded-2xl border border-gray-800 bg-gray-900 p-6">
              <h2 className="mb-1 text-lg font-semibold text-white">Activity</h2>
              <p className="mb-4 text-xs text-gray-500">Reviews per day over the past year</p>
              <div className="overflow-x-auto">
                <div style={{ minWidth: "680px" }}>
                  {/* Month labels */}
                  <div className="mb-1 flex" style={{ paddingLeft: "20px" }}>
                    {weekColumns.map((_, wi) => {
                      const label = monthLabels.find((m) => m.col === wi);
                      return (
                        <div key={wi} style={{ width: "11px", marginRight: "2px", flexShrink: 0 }}>
                          {label && <span className="text-[9px] text-gray-600">{label.label}</span>}
                        </div>
                      );
                    })}
                  </div>
                  <div className="flex gap-0.5">
                    {/* Day labels */}
                    <div className="mr-1 flex flex-col gap-0.5">
                      {["", "M", "", "W", "", "F", ""].map((d, i) => (
                        <div key={i} className="flex h-[11px] items-center justify-end text-[9px] text-gray-600">
                          {d}
                        </div>
                      ))}
                    </div>
                    {/* Grid */}
                    {weekColumns.map((week, wi) => (
                      <div key={wi} className="flex flex-col gap-0.5">
                        {week.map((cell, di) => (
                          <div
                            key={di}
                            title={`${cell.date.toLocaleDateString()}: ${cell.count} review${cell.count !== 1 ? "s" : ""}`}
                            className={`h-[11px] w-[11px] rounded-sm ${colourClass(cell.count)}`}
                          />
                        ))}
                      </div>
                    ))}
                  </div>
                  {/* Legend */}
                  <div className="mt-2 flex items-center gap-1 justify-end">
                    <span className="text-[10px] text-gray-600">Less</span>
                    {["bg-gray-800", "bg-emerald-900", "bg-emerald-700", "bg-emerald-500", "bg-emerald-400"].map((c) => (
                      <div key={c} className={`h-[11px] w-[11px] rounded-sm ${c}`} />
                    ))}
                    <span className="text-[10px] text-gray-600">More</span>
                  </div>
                </div>
              </div>
            </div>
          );
        })()}

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

        <div className="mb-8 rounded-2xl border border-gray-800 bg-gray-900 p-6">
          <h2 className="mb-1 text-lg font-semibold text-white">Forecast</h2>
          <p className="mb-5 text-xs text-gray-500">Projected reviews based on current due dates</p>

          <div className="mb-6 flex items-end gap-2">
            {forecast.map((day) => (
              <div key={day.label} className="flex flex-1 flex-col items-center gap-1">
                <span className="text-xs font-medium text-gray-300">{day.count}</span>
                <div className="w-full rounded-t-md bg-emerald-500/20 transition-all" style={{ height: `${Math.max((day.count / forecastMax) * 80, day.count > 0 ? 4 : 2)}px` }}>
                  <div className="h-full w-full rounded-t-md bg-emerald-500" style={{ opacity: day.count > 0 ? 1 : 0.2 }} />
                </div>
                <span className="text-[10px] text-gray-500">{day.label}</span>
              </div>
            ))}
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-xl border border-gray-800 bg-gray-950 p-4">
              <div className="mb-1 text-xs text-gray-500">Due in 30 days</div>
              <div className="text-2xl font-bold text-white">{dueIn30}</div>
              <div className="mt-1 text-xs text-gray-600">cards to review</div>
            </div>
            <div className="rounded-xl border border-gray-800 bg-gray-950 p-4">
              <div className="mb-1 text-xs text-gray-500">Days to learn all new cards</div>
              <div className="text-2xl font-bold text-white">
                {daysToLearnAll > 0 ? daysToLearnAll : "—"}
              </div>
              <div className="mt-1 text-xs text-gray-600">
                {daysToLearnAll > 0 ? `at ${dailyNewLimit}/day` : "no new cards"}
              </div>
            </div>
            <div className="rounded-xl border border-gray-800 bg-gray-950 p-4">
              <div className="mb-1 text-xs text-gray-500">Avg review interval</div>
              <div className="text-2xl font-bold text-white">
                {avgInterval > 0 ? `${avgInterval}d` : "—"}
              </div>
              <div className="mt-1 text-xs text-gray-600">
                {reviewCards.length > 0 ? `across ${reviewCards.length} review cards` : "no review cards yet"}
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
