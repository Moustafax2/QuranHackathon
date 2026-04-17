import { FSRSState } from "@/lib/types/flashcard";
import type { MemorizationAttempt } from "@/lib/memorization/types";
import type { ReviewLogEntry, UserFlashcard } from "@/lib/types/flashcard";
import type {
  CoverageBucket,
  DashboardMode,
  FlashcardProgressSummary,
  PlayProgressResponse,
  ProgressDashboard,
  ProgressEvent,
  Recommendation,
} from "@/lib/progress/types";
import {
  buildCoverageBuckets,
  calculateDayStreak,
  DASHBOARD_MODE_ORDER,
  resolveDashboardSources,
  summarizeMode,
} from "@/lib/progress/utils";

function flashcardRatingToScore(rating: number): number {
  if (rating <= 1) return 0;
  if (rating === 2) return 0.4;
  if (rating === 3) return 0.8;
  return 1;
}

function memorizationRatingToScore(level: number): number {
  if (level <= 0) return 0;
  if (level === 1) return 0.5;
  return 1;
}

function normalizePlayEvents(play: PlayProgressResponse | null): ProgressEvent[] {
  if (!play) return [];

  return play.events
    .filter((event) => event.mode !== "buzzer")
    .map((event) => ({
      id: event.id,
      mode: event.mode as Exclude<DashboardMode, "flashcards" | "memorization-tester">,
      source: "synced",
      timestamp: event.tested_at,
      score: event.correct ? 1 : 0,
      success: event.correct,
      verseKey: event.prompt_verse_key,
      surahId: event.prompt_surah_id,
      juzNumber: event.prompt_juz_number,
      pageNumber: event.prompt_page_number,
      points: event.points_awarded,
    }));
}

function normalizeFlashcardEvents(
  reviews: ReviewLogEntry[],
  cards: UserFlashcard[],
  source: "synced" | "local"
): ProgressEvent[] {
  const cardMap = new Map(cards.map((card) => [card.id, card]));

  return reviews.map((review) => {
    const card = cardMap.get(review.card_id);
    const score = flashcardRatingToScore(review.rating);
    return {
      id: review.id,
      mode: "flashcards",
      source,
      timestamp: review.timestamp.toISOString(),
      score,
      success: review.rating >= 3,
      verseKey:
        card?.source_surah_id != null && card.source_ayah_number != null
          ? `${card.source_surah_id}:${card.source_ayah_number}`
          : null,
      surahId: card?.source_surah_id ?? null,
      juzNumber: card?.source_juz_number ?? null,
      pageNumber: card?.source_page_number ?? null,
      points: 0,
    };
  });
}

function normalizeMemorizationEvents(
  attempts: MemorizationAttempt[],
  source: "synced" | "local"
): ProgressEvent[] {
  return attempts.map((attempt) => ({
    id: attempt.client_attempt_id,
    mode: "memorization-tester",
    source,
    timestamp: attempt.tested_at.toISOString(),
    score: memorizationRatingToScore(attempt.rating_level),
    success: attempt.rating_level === 2,
    verseKey: attempt.verse_key,
    surahId: attempt.surah_id,
    juzNumber: attempt.juz_number,
    pageNumber: attempt.page_number,
    points: 0,
  }));
}

function buildFlashcardSummary(input: {
  cards: UserFlashcard[];
  reviews: ReviewLogEntry[];
  dueCount: number;
  newCount: number;
  source: FlashcardProgressSummary["source"];
}): FlashcardProgressSummary {
  const matureCards = input.cards.filter(
    (card) =>
      card.fsrs_state.state === FSRSState.Review && card.fsrs_state.stability >= 21
  ).length;
  const learningCards = input.cards.filter(
    (card) =>
      card.fsrs_state.state === FSRSState.Learning ||
      card.fsrs_state.state === FSRSState.Relearning
  ).length;
  const successfulReviews = input.reviews.filter((review) => review.rating >= 3).length;

  return {
    totalCards: input.cards.length,
    dueCount: input.dueCount,
    newCount: input.newCount,
    reviews: input.reviews.length,
    retentionRate:
      input.reviews.length > 0 ? successfulReviews / input.reviews.length : null,
    matureCards,
    learningCards,
    source: input.source,
  };
}

function pickWeakCoverageBucket(buckets: CoverageBucket[]): CoverageBucket | null {
  return (
    buckets
      .filter((bucket) => bucket.attempts >= 2)
      .sort((a, b) => {
        if (a.averageScore !== b.averageScore) {
          return a.averageScore - b.averageScore;
        }
        if (a.attempts !== b.attempts) {
          return b.attempts - a.attempts;
        }
        return a.id - b.id;
      })[0] ?? null
  );
}

function buildRecommendations(input: {
  hasPlayer: boolean;
  modeSummaries: ReturnType<typeof summarizeMode>[];
  coverage: ProgressDashboard["coverage"];
  flashcards: FlashcardProgressSummary;
  play: PlayProgressResponse | null;
}): Recommendation[] {
  const recommendations: Recommendation[] = [];

  if (input.flashcards.dueCount > 0) {
    recommendations.push({
      id: "flashcards-due",
      title: `${input.flashcards.dueCount} flashcards are due`,
      description: "A short review session will give you the fastest progress boost today.",
      href: "/train/flashcards/review",
      ctaLabel: "Review flashcards",
    });
  }

  const weakestMode = input.modeSummaries
    .filter((summary) => summary.attempts >= 3 && summary.averageScore !== null)
    .sort((a, b) => {
      if ((a.averageScore ?? 0) !== (b.averageScore ?? 0)) {
        return (a.averageScore ?? 0) - (b.averageScore ?? 0);
      }
      return b.attempts - a.attempts;
    })[0];

  if (weakestMode) {
    recommendations.push({
      id: "weakest-mode",
      title: `${weakestMode.label} needs the most attention`,
      description: `Your recent score here is lower than the rest of your modes. A focused round can lift your overall consistency.`,
      href:
        weakestMode.mode === "flashcards"
          ? "/train/flashcards"
          : weakestMode.mode === "memorization-tester"
          ? "/train/memorization-tester"
          : "/play",
      ctaLabel:
        weakestMode.mode === "flashcards"
          ? "Open flashcards"
          : weakestMode.mode === "memorization-tester"
          ? "Open memorization tester"
          : "Open play mode",
    });
  }

  const weakCoverage =
    pickWeakCoverageBucket(input.coverage.surah) ??
    pickWeakCoverageBucket(input.coverage.juz) ??
    pickWeakCoverageBucket(input.coverage.page);

  if (weakCoverage) {
    recommendations.push({
      id: "weak-coverage",
      title: `Revisit ${weakCoverage.label}`,
      description: `This area has one of your lowest recent scores across all tracked modes.`,
    });
  }

  if (!input.hasPlayer) {
    recommendations.push({
      id: "create-player",
      title: "Unlock synced play and memorization progress",
      description: "Continue as a guest in Play or sign in to keep multiplayer and memorization history across visits.",
      href: "/play",
      ctaLabel: "Open play",
    });
  }

  const unplayedMode = input.modeSummaries.find((summary) => summary.attempts === 0);
  if (unplayedMode) {
    recommendations.push({
      id: "try-new-mode",
      title: `You have not tried ${unplayedMode.label} yet`,
      description: "Trying one more mode will make the dashboard a better reflection tool and reveal new weak spots.",
      href:
        unplayedMode.mode === "flashcards"
          ? "/train/flashcards"
          : unplayedMode.mode === "memorization-tester"
          ? "/train/memorization-tester"
          : "/play",
      ctaLabel: "Start now",
    });
  }

  if ((input.play?.hotspots.length ?? 0) > 0) {
    const hotspot = input.play?.hotspots[0];
    if (hotspot) {
      recommendations.push({
        id: "play-hotspot",
        title: `Most-missed verse: ${hotspot.verse_key}`,
        description: `This verse has tripped you up ${hotspot.mistake_count} time${hotspot.mistake_count === 1 ? "" : "s"} in play.`,
      });
    }
  }

  const seen = new Set<string>();
  return recommendations.filter((recommendation) => {
    if (seen.has(recommendation.id)) return false;
    seen.add(recommendation.id);
    return true;
  }).slice(0, 4);
}

export function buildProgressDashboard(input: {
  isAuthenticated: boolean;
  hasPlayer: boolean;
  play: PlayProgressResponse | null;
  flashcards: UserFlashcard[];
  reviews: ReviewLogEntry[];
  dueCount: number;
  newCount: number;
  memorizationAttempts: MemorizationAttempt[];
}): ProgressDashboard {
  const sources = resolveDashboardSources({
    isAuthenticated: input.isAuthenticated,
    hasPlayer: input.hasPlayer,
  });

  const playEvents = normalizePlayEvents(input.play);
  const flashcardEvents = normalizeFlashcardEvents(
    input.reviews,
    input.flashcards,
    sources.flashcards === "synced" ? "synced" : "local"
  );
  const memorizationEvents = normalizeMemorizationEvents(
    input.memorizationAttempts,
    sources.memorization === "synced" ? "synced" : "local"
  );

  const allEvents = [...playEvents, ...flashcardEvents, ...memorizationEvents].sort((a, b) =>
    a.timestamp.localeCompare(b.timestamp)
  );

  const modeSummaries = DASHBOARD_MODE_ORDER.map((mode) => {
    const modeEvents = allEvents.filter((event) => event.mode === mode);
    const source =
      mode === "flashcards"
        ? sources.flashcards
        : mode === "memorization-tester"
        ? sources.memorization
        : sources.play;
    return summarizeMode(mode, modeEvents, source);
  });

  const totalAttempts = allEvents.length;
  const successfulAttempts = allEvents.filter((event) => event.success).length;
  const averageScore =
    totalAttempts > 0
      ? allEvents.reduce((sum, event) => sum + event.score, 0) / totalAttempts
      : null;
  const activeDays = new Set(
    allEvents.map((event) => {
      const date = new Date(event.timestamp);
      date.setHours(0, 0, 0, 0);
      return date.getTime();
    })
  ).size;

  const rankedModes = modeSummaries.filter(
    (summary) => summary.attempts > 0 && summary.averageScore !== null
  );
  const strongestMode =
    rankedModes
      .slice()
      .sort((a, b) => {
        if ((a.averageScore ?? 0) !== (b.averageScore ?? 0)) {
          return (b.averageScore ?? 0) - (a.averageScore ?? 0);
        }
        return b.attempts - a.attempts;
      })[0]?.mode ?? null;
  const weakestMode =
    rankedModes
      .slice()
      .sort((a, b) => {
        if ((a.averageScore ?? 0) !== (b.averageScore ?? 0)) {
          return (a.averageScore ?? 0) - (b.averageScore ?? 0);
        }
        return b.attempts - a.attempts;
      })[0]?.mode ?? null;

  const coverage = {
    juz: buildCoverageBuckets(allEvents, "juz"),
    surah: buildCoverageBuckets(allEvents, "surah"),
    page: buildCoverageBuckets(allEvents, "page"),
  };

  const flashcards = buildFlashcardSummary({
    cards: input.flashcards,
    reviews: input.reviews,
    dueCount: input.dueCount,
    newCount: input.newCount,
    source: sources.flashcards,
  });

  return {
    overview: {
      totalAttempts,
      successRate: totalAttempts > 0 ? successfulAttempts / totalAttempts : null,
      averageScore,
      streakDays: calculateDayStreak(allEvents),
      activeDays,
      strongestMode,
      weakestMode,
    },
    sources,
    modeSummaries,
    events: allEvents,
    coverage,
    insights: buildRecommendations({
      hasPlayer: input.hasPlayer,
      modeSummaries,
      coverage,
      flashcards,
      play: input.play,
    }),
    hotspots: input.play?.hotspots ?? [],
    flashcards,
    player: input.play?.player ?? null,
  };
}
