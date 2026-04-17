import assert from "node:assert/strict";
import { FSRSState, Rating, WordStatus } from "../types/flashcard";
import { buildProgressDashboard } from "./dashboard";

function runCase(name: string, fn: () => void) {
  fn();
  console.log(`ok - ${name}`);
}

export function runDashboardTests() {
  runCase("buildProgressDashboard merges guest play, local flashcards, and memorization history", () => {
    const dashboard = buildProgressDashboard({
      isAuthenticated: false,
      hasPlayer: true,
      play: {
        player: {
          id: "player-1",
          display_name: "Guest 4242",
          total_points: 120,
          total_wins: 2,
          created_at: "2026-04-01T00:00:00.000Z",
        },
        events: [
          {
            id: "play-answer-1",
            mode: "multiple-choice",
            correct: true,
            points_awarded: 100,
            tested_at: "2026-04-12T10:00:00.000Z",
            prompt_verse_key: "2:255",
            prompt_surah_id: 2,
            prompt_juz_number: 3,
            prompt_page_number: 42,
          },
          {
            id: "play-answer-2",
            mode: "trivia",
            correct: false,
            points_awarded: 0,
            tested_at: "2026-04-12T11:00:00.000Z",
            prompt_verse_key: "trivia-angels-1",
            prompt_surah_id: null,
            prompt_juz_number: null,
            prompt_page_number: null,
          },
        ],
        hotspots: [
          {
            verse_key: "2:255",
            mistake_count: 3,
            last_mistake_at: "2026-04-12T11:00:00.000Z",
          },
        ],
      },
      flashcards: [
        {
          id: "card-1",
          word_id: "word-1",
          status: WordStatus.IN_BANK,
          fsrs_state: {
            due: new Date("2026-04-15T00:00:00.000Z"),
            stability: 30,
            difficulty: 4,
            elapsed_days: 3,
            scheduled_days: 7,
            learning_steps: 0,
            reps: 5,
            lapses: 0,
            state: FSRSState.Review,
            last_review: new Date("2026-04-12T09:00:00.000Z"),
          },
          created_at: new Date("2026-04-01T00:00:00.000Z"),
          source_surah_id: 2,
          source_ayah_number: 255,
          source_juz_number: 3,
          source_page_number: 42,
        },
      ],
      reviews: [
        {
          id: "review-1",
          card_id: "card-1",
          word_id: "word-1",
          rating: Rating.Hard,
          timestamp: new Date("2026-04-12T09:00:00.000Z"),
          session_id: "session-1",
          review_duration_ms: 1500,
          state_before: FSRSState.Learning,
          state_after: FSRSState.Review,
        },
      ],
      dueCount: 2,
      newCount: 1,
      memorizationAttempts: [
        {
          id: "attempt-1",
          client_attempt_id: "attempt-1",
          mode: "ayah",
          rating_level: 2,
          verse_key: "2:255",
          surah_id: 2,
          ayah_number: 255,
          juz_number: 3,
          page_number: 42,
          selection_type: "juz",
          cover_region: null,
          tested_at: new Date("2026-04-13T08:00:00.000Z"),
        },
      ],
    });

    assert.deepEqual(dashboard.sources, {
      overall: "mixed",
      play: "synced",
      flashcards: "local",
      memorization: "synced",
    });

    assert.equal(dashboard.player?.display_name, "Guest 4242");
    assert.equal(dashboard.flashcards.source, "local");
    assert.equal(
      dashboard.modeSummaries.find((summary) => summary.mode === "flashcards")?.attempts,
      1
    );
    assert.equal(
      dashboard.modeSummaries.find((summary) => summary.mode === "memorization-tester")?.attempts,
      1
    );
    assert.equal(dashboard.events.length, 4);
    assert.equal(dashboard.coverage.juz[0]?.id, 3);
    assert.equal(dashboard.coverage.juz[0]?.attempts, 3);
    assert.equal(
      dashboard.insights.some((insight) => insight.id === "flashcards-due"),
      true
    );
    assert.equal(dashboard.overview.weakestMode, "trivia");
    assert.equal(dashboard.hotspots[0]?.verse_key, "2:255");
  });

  runCase("buildProgressDashboard keeps local-only users in training mode", () => {
    const dashboard = buildProgressDashboard({
      isAuthenticated: false,
      hasPlayer: false,
      play: null,
      flashcards: [],
      reviews: [],
      dueCount: 0,
      newCount: 0,
      memorizationAttempts: [
        {
          id: "attempt-local-1",
          client_attempt_id: "attempt-local-1",
          mode: "page-blank",
          rating_level: 1,
          verse_key: null,
          surah_id: 36,
          ayah_number: null,
          juz_number: 22,
          page_number: 440,
          selection_type: "surah",
          cover_region: "middle",
          tested_at: new Date("2026-04-14T08:00:00.000Z"),
        },
      ],
    });

    assert.equal(dashboard.sources.overall, "local");
    assert.equal(dashboard.sources.play, "unavailable");
    assert.equal(
      dashboard.modeSummaries.find((summary) => summary.mode === "memorization-tester")?.source,
      "local"
    );
    assert.equal(dashboard.events.length, 1);
    assert.equal(dashboard.coverage.page[0]?.id, 440);
  });
}
