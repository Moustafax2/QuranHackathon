import assert from "node:assert/strict";
import type { ProgressEvent } from "./types";
import {
  buildCoverageBucketDetails,
  buildCoverageBuckets,
  filterProgressEventsByModes,
  inferStoredRoundMode,
  resolveDashboardSources,
} from "./utils";

function runCase(name: string, fn: () => void) {
  fn();
  console.log(`ok - ${name}`);
}

export function runUtilsTests() {
  runCase("inferStoredRoundMode preserves stored modes and falls back to round signatures", () => {
    assert.equal(
      inferStoredRoundMode({
        promptVerseKey: "2:255",
        options: null,
        gameMode: "trivia",
      }),
      "trivia"
    );

    assert.equal(
      inferStoredRoundMode({
        promptVerseKey: "trivia-prophets-1",
        options: [],
      }),
      "trivia"
    );

    assert.equal(
      inferStoredRoundMode({
        promptVerseKey: "1:1",
        options: [{ verse_key: "meaning:mercy" }],
      }),
      "word-meaning"
    );

    assert.equal(
      inferStoredRoundMode({
        promptVerseKey: "2:1",
        options: ['{"verse_key":"fill:2:1"}'],
      }),
      "fill-in-blank"
    );

    assert.equal(
      inferStoredRoundMode({
        promptVerseKey: "3:7",
        options: [{ verse_key: "3:7" }, { verse_key: "3:8" }],
      }),
      "multiple-choice"
    );
  });

  runCase("buildCoverageBuckets groups exact Quran locations and excludes trivia", () => {
    const events: ProgressEvent[] = [
      {
        id: "play-1",
        mode: "multiple-choice",
        source: "synced",
        timestamp: "2026-04-10T10:00:00.000Z",
        score: 1,
        success: true,
        verseKey: "1:1",
        surahId: 1,
        juzNumber: 1,
        pageNumber: 1,
        points: 100,
      },
      {
        id: "mem-1",
        mode: "memorization-tester",
        source: "local",
        timestamp: "2026-04-11T10:00:00.000Z",
        score: 0.5,
        success: false,
        verseKey: "2:255",
        surahId: 2,
        juzNumber: 3,
        pageNumber: 42,
        points: 0,
      },
      {
        id: "flash-1",
        mode: "flashcards",
        source: "local",
        timestamp: "2026-04-12T10:00:00.000Z",
        score: 0.8,
        success: true,
        verseKey: "2:256",
        surahId: 2,
        juzNumber: 3,
        pageNumber: 42,
        points: 0,
      },
      {
        id: "trivia-1",
        mode: "trivia",
        source: "synced",
        timestamp: "2026-04-12T12:00:00.000Z",
        score: 0,
        success: false,
        verseKey: null,
        surahId: null,
        juzNumber: null,
        pageNumber: null,
        points: 0,
      },
    ];

    const juzBuckets = buildCoverageBuckets(events, "juz");
    const surahBuckets = buildCoverageBuckets(events, "surah");
    const pageBuckets = buildCoverageBuckets(events, "page");

    assert.deepEqual(
      juzBuckets.map((bucket) => bucket.id),
      [1, 3]
    );
    assert.deepEqual(
      surahBuckets.map((bucket) => bucket.id),
      [1, 2]
    );
    assert.deepEqual(
      pageBuckets.map((bucket) => bucket.id),
      [1, 42]
    );

    assert.equal(surahBuckets[1]?.attempts, 2);
    assert.equal(surahBuckets[1]?.label, "Al-Baqarah");
    assert.equal(pageBuckets[1]?.successRate, 0.5);
  });

  runCase("resolveDashboardSources handles auth, guest, and local-only users", () => {
    assert.deepEqual(resolveDashboardSources({ isAuthenticated: true, hasPlayer: true }), {
      overall: "synced",
      play: "synced",
      flashcards: "synced",
      memorization: "synced",
    });

    assert.deepEqual(resolveDashboardSources({ isAuthenticated: false, hasPlayer: true }), {
      overall: "mixed",
      play: "synced",
      flashcards: "local",
      memorization: "synced",
    });

    assert.deepEqual(resolveDashboardSources({ isAuthenticated: false, hasPlayer: false }), {
      overall: "local",
      play: "unavailable",
      flashcards: "local",
      memorization: "local",
    });
  });

  runCase("filterProgressEventsByModes supports multi-select coverage filters", () => {
    const events: ProgressEvent[] = [
      {
        id: "play-1",
        mode: "multiple-choice",
        source: "synced",
        timestamp: "2026-04-10T10:00:00.000Z",
        score: 1,
        success: true,
        verseKey: "1:1",
        surahId: 1,
        juzNumber: 1,
        pageNumber: 1,
        points: 100,
      },
      {
        id: "flash-1",
        mode: "flashcards",
        source: "local",
        timestamp: "2026-04-12T10:00:00.000Z",
        score: 0.8,
        success: true,
        verseKey: "2:256",
        surahId: 2,
        juzNumber: 3,
        pageNumber: 42,
        points: 0,
      },
      {
        id: "mem-1",
        mode: "memorization-tester",
        source: "local",
        timestamp: "2026-04-11T10:00:00.000Z",
        score: 0.5,
        success: false,
        verseKey: "2:255",
        surahId: 2,
        juzNumber: 3,
        pageNumber: 42,
        points: 0,
      },
    ];

    assert.equal(filterProgressEventsByModes(events, []).length, 3);
    assert.deepEqual(
      filterProgressEventsByModes(events, ["flashcards", "memorization-tester"]).map(
        (event) => event.id
      ),
      ["flash-1", "mem-1"]
    );
  });

  runCase("buildCoverageBucketDetails explains the score source for a clicked bucket", () => {
    const events: ProgressEvent[] = [
      {
        id: "play-1",
        mode: "multiple-choice",
        source: "synced",
        timestamp: "2026-04-10T10:00:00.000Z",
        score: 1,
        success: true,
        verseKey: "1:1",
        surahId: 1,
        juzNumber: 1,
        pageNumber: 1,
        points: 100,
      },
      {
        id: "flash-1",
        mode: "flashcards",
        source: "local",
        timestamp: "2026-04-12T10:00:00.000Z",
        score: 0.8,
        success: true,
        verseKey: "2:256",
        surahId: 2,
        juzNumber: 3,
        pageNumber: 42,
        points: 0,
      },
      {
        id: "mem-1",
        mode: "memorization-tester",
        source: "local",
        timestamp: "2026-04-11T10:00:00.000Z",
        score: 0.5,
        success: false,
        verseKey: "2:255",
        surahId: 2,
        juzNumber: 3,
        pageNumber: 42,
        points: 0,
      },
    ];

    const details = buildCoverageBucketDetails(events, "page", 42);

    assert.ok(details);
    assert.equal(details?.bucket.id, 42);
    assert.equal(details?.bucket.attempts, 2);
    assert.equal(details?.modeBreakdown.length, 2);
    assert.equal(details?.events[0]?.id, "flash-1");
  });
}
