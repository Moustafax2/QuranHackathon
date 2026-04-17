import { CHAPTERS_DATA } from "@/lib/data/chapters-data";
import type { PlayGameMode } from "@/lib/supabase/types";
import type {
  CoverageBucket,
  CoverageBucketDetails,
  CoverageDimension,
  DashboardMode,
  DashboardSources,
  ModeSummary,
  ProgressEvent,
  SourceState,
} from "@/lib/progress/types";

const SURAH_NAME_BY_ID = new Map(CHAPTERS_DATA.map((chapter) => [chapter.id, chapter.name_simple]));

export const DASHBOARD_MODE_ORDER: DashboardMode[] = [
  "multiple-choice",
  "word-meaning",
  "fill-in-blank",
  "trivia",
  "flashcards",
  "memorization-tester",
];

export const MODE_LABELS: Record<DashboardMode, string> = {
  "multiple-choice": "Multiple Choice",
  "word-meaning": "Word Meaning",
  "fill-in-blank": "Fill in the Blank",
  trivia: "Trivia",
  flashcards: "Flashcards",
  "memorization-tester": "Memorization Tester",
};

export function inferStoredRoundMode(input: {
  promptVerseKey: string;
  options: unknown[] | null;
  gameMode?: PlayGameMode | null;
}): PlayGameMode {
  if (input.gameMode) return input.gameMode;
  if (input.promptVerseKey.startsWith("trivia-")) return "trivia";
  if (!input.options || input.options.length === 0) return "buzzer";

  const parsedOptions = input.options.map((option) => {
    if (typeof option === "string") {
      try {
        return JSON.parse(option) as { verse_key?: string };
      } catch {
        return { verse_key: option };
      }
    }

    return option as { verse_key?: string };
  });

  if (parsedOptions.some((option) => option.verse_key?.startsWith("meaning:"))) {
    return "word-meaning";
  }

  if (parsedOptions.some((option) => option.verse_key?.startsWith("fill:"))) {
    return "fill-in-blank";
  }

  return "multiple-choice";
}

export function getCoverageLabel(dimension: CoverageDimension, id: number): string {
  if (dimension === "juz") return `Juz ${id}`;
  if (dimension === "page") return `Page ${id}`;
  return SURAH_NAME_BY_ID.get(id) ?? `Surah ${id}`;
}

export function getCoverageRange(dimension: CoverageDimension): number {
  if (dimension === "juz") return 30;
  if (dimension === "surah") return 114;
  return 604;
}

export function getCoverageBucketKey(
  event: ProgressEvent,
  dimension: CoverageDimension
): number | null {
  if (event.mode === "trivia") return null;

  return dimension === "juz"
    ? event.juzNumber
    : dimension === "surah"
    ? event.surahId
    : event.pageNumber;
}

export function filterProgressEventsByModes(
  events: ProgressEvent[],
  modes: DashboardMode[]
): ProgressEvent[] {
  if (modes.length === 0) return events;
  const selectedModes = new Set(modes);
  return events.filter((event) => selectedModes.has(event.mode));
}

export function buildCoverageBuckets(
  events: ProgressEvent[],
  dimension: CoverageDimension
): CoverageBucket[] {
  const grouped = new Map<number, ProgressEvent[]>();

  for (const event of events) {
    const key = getCoverageBucketKey(event, dimension);
    if (key == null) continue;
    const bucket = grouped.get(key) ?? [];
    bucket.push(event);
    grouped.set(key, bucket);
  }

  return Array.from(grouped.entries())
    .map(([id, bucketEvents]) => {
      const attempts = bucketEvents.length;
      const successes = bucketEvents.filter((event) => event.success).length;
      const averageScore =
        attempts > 0
          ? bucketEvents.reduce((sum, event) => sum + event.score, 0) / attempts
          : 0;
      const lastActivityAt =
        bucketEvents
          .map((event) => event.timestamp)
          .sort((a, b) => b.localeCompare(a))[0] ?? null;
      const modes = Array.from(new Set(bucketEvents.map((event) => event.mode)));

      return {
        dimension,
        id,
        label: getCoverageLabel(dimension, id),
        attempts,
        successRate: attempts > 0 ? successes / attempts : 0,
        averageScore,
        lastActivityAt,
        modes,
      };
    })
    .sort((a, b) => a.id - b.id);
}

export function buildCoverageBucketDetails(
  events: ProgressEvent[],
  dimension: CoverageDimension,
  id: number
): CoverageBucketDetails | null {
  const bucketEvents = events
    .filter((event) => getCoverageBucketKey(event, dimension) === id)
    .slice()
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp));

  if (bucketEvents.length === 0) return null;

  const bucket = buildCoverageBuckets(bucketEvents, dimension)[0];
  if (!bucket) return null;

  const modeBreakdown = Array.from(
    bucketEvents.reduce((map, event) => {
      const current = map.get(event.mode) ?? [];
      current.push(event);
      map.set(event.mode, current);
      return map;
    }, new Map<DashboardMode, ProgressEvent[]>())
  )
    .map(([mode, modeEvents]) => {
      const attempts = modeEvents.length;
      const successes = modeEvents.filter((event) => event.success).length;
      const averageScore =
        modeEvents.reduce((sum, event) => sum + event.score, 0) / attempts;
      const lastActivityAt =
        modeEvents
          .map((event) => event.timestamp)
          .sort((a, b) => b.localeCompare(a))[0] ?? null;

      return {
        mode,
        label: MODE_LABELS[mode],
        attempts,
        successRate: successes / attempts,
        averageScore,
        lastActivityAt,
      };
    })
    .sort((a, b) => {
      if (a.attempts !== b.attempts) return b.attempts - a.attempts;
      return a.label.localeCompare(b.label);
    });

  return {
    bucket,
    events: bucketEvents,
    modeBreakdown,
  };
}

export function calculateDayStreak(events: ProgressEvent[]): number {
  if (events.length === 0) return 0;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const days = new Set(
    events.map((event) => {
      const date = new Date(event.timestamp);
      date.setHours(0, 0, 0, 0);
      return date.getTime();
    })
  );

  let cursor = today.getTime();
  if (!days.has(cursor)) {
    cursor -= 86_400_000;
    if (!days.has(cursor)) {
      return 0;
    }
  }

  let streak = 0;
  while (days.has(cursor)) {
    streak += 1;
    cursor -= 86_400_000;
  }

  return streak;
}

export function resolveDashboardSources(input: {
  isAuthenticated: boolean;
  hasPlayer: boolean;
}): DashboardSources {
  const play = input.hasPlayer ? "synced" : "unavailable";
  const flashcards = input.isAuthenticated ? "synced" : "local";
  const memorization = input.hasPlayer ? "synced" : "local";

  const uniqueSources = new Set<SourceState>([play, flashcards, memorization]);
  uniqueSources.delete("unavailable");

  let overall: SourceState;
  if (uniqueSources.size === 0) {
    overall = "unavailable";
  } else if (uniqueSources.size === 1) {
    overall = Array.from(uniqueSources)[0] ?? "unavailable";
  } else {
    overall = "mixed";
  }

  return {
    overall,
    play,
    flashcards,
    memorization,
  };
}

export function summarizeMode(
  mode: DashboardMode,
  events: ProgressEvent[],
  source: SourceState
): ModeSummary {
  const attempts = events.length;
  const totalPoints = events.reduce((sum, event) => sum + event.points, 0);
  const lastActivityAt =
    events.map((event) => event.timestamp).sort((a, b) => b.localeCompare(a))[0] ?? null;

  if (attempts === 0) {
    return {
      mode,
      label: MODE_LABELS[mode],
      attempts: 0,
      successRate: null,
      averageScore: null,
      lastActivityAt: null,
      totalPoints,
      source,
    };
  }

  const successes = events.filter((event) => event.success).length;
  const averageScore = events.reduce((sum, event) => sum + event.score, 0) / attempts;

  return {
    mode,
    label: MODE_LABELS[mode],
    attempts,
    successRate: successes / attempts,
    averageScore,
    lastActivityAt,
    totalPoints,
    source,
  };
}
