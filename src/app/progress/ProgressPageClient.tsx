"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getDueCardsCount, getNewCardsCount } from "@/lib/flashcard/session-manager";
import { useAuth } from "@/lib/hooks/useAuth";
import { getMemorizationAttempts } from "@/lib/memorization/storage";
import { buildProgressDashboard } from "@/lib/progress/dashboard";
import type {
  CoverageBucket,
  CoverageBucketDetails,
  CoverageDimension,
  DashboardMode,
  PlayProgressResponse,
  ProgressDashboard,
  ProgressEvent,
  SourceState,
} from "@/lib/progress/types";
import {
  buildCoverageBuckets,
  buildCoverageBucketDetails,
  filterProgressEventsByModes,
  getCoverageLabel,
  getCoverageRange,
  MODE_LABELS,
} from "@/lib/progress/utils";
import {
  getFlashcards,
  getReviewLog,
  migrateFromLocalStorage,
} from "@/lib/storage/flashcard-storage-supabase";

const MODE_LINKS: Record<DashboardMode, string> = {
  "multiple-choice": "/play",
  "word-meaning": "/play",
  "fill-in-blank": "/play",
  trivia: "/play",
  flashcards: "/train/flashcards",
  "memorization-tester": "/train/memorization-tester",
};

const COVERAGE_TABS: Array<{ id: CoverageDimension; label: string }> = [
  { id: "juz", label: "Juz" },
  { id: "surah", label: "Surah" },
  { id: "page", label: "Page" },
];

const COVERAGE_FILTER_MODES: DashboardMode[] = [
  "multiple-choice",
  "word-meaning",
  "fill-in-blank",
  "flashcards",
  "memorization-tester",
];

function formatPercent(value: number | null): string {
  if (value === null) return "No data yet";
  return `${Math.round(value * 100)}%`;
}

function formatScore(value: number | null): string {
  if (value === null) return "No data yet";
  return `${Math.round(value * 100)}/100`;
}

function formatDate(value: string | null): string {
  if (!value) return "No activity yet";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

function formatAttemptScore(event: ProgressEvent): string {
  return `${Math.round(event.score * 100)}%`;
}

function formatCoverageEventContext(event: ProgressEvent): string {
  const parts: string[] = [];

  if (event.verseKey) {
    parts.push(`Verse ${event.verseKey}`);
  } else if (event.pageNumber != null) {
    parts.push(`Page ${event.pageNumber}`);
  }

  if (event.surahId != null) {
    parts.push(`Surah ${event.surahId}`);
  }

  if (event.juzNumber != null) {
    parts.push(`Juz ${event.juzNumber}`);
  }

  return parts.join(" • ") || "Exact location recorded";
}

function sourceLabel(source: SourceState): string {
  if (source === "synced") return "Synced";
  if (source === "local") return "This device only";
  if (source === "mixed") return "Mixed sources";
  return "Unavailable";
}

function sourceBadgeClass(source: SourceState): string {
  if (source === "synced") {
    return "border-emerald-500/30 bg-emerald-500/10 text-emerald-300";
  }
  if (source === "local") {
    return "border-amber-500/30 bg-amber-500/10 text-amber-300";
  }
  if (source === "mixed") {
    return "border-blue-500/30 bg-blue-500/10 text-blue-300";
  }
  return "border-gray-700 bg-gray-800 text-gray-400";
}

function getProgressEventHref(event: ProgressEvent): string | null {
  const translationsQuery = event.mode === "word-meaning" ? "?translations=1" : "";

  if (event.surahId != null && event.verseKey?.includes(":")) {
    const ayahNumber = event.verseKey.split(":")[1];
    if (ayahNumber) {
      return `/quran/surah/${event.surahId}${translationsQuery}#ayah-${ayahNumber}`;
    }
  }

  if (event.pageNumber != null) {
    return `/quran/page-view/${event.pageNumber}${translationsQuery}`;
  }

  if (event.surahId != null) {
    return `/quran/surah/${event.surahId}${translationsQuery}`;
  }

  return null;
}

function coverageTone(bucket: CoverageBucket | undefined): string {
  if (!bucket) return "border-gray-800 bg-gray-950 text-gray-600";
  if (bucket.averageScore < 0.45) {
    return "border-red-500/30 bg-red-500/10 text-red-200";
  }
  if (bucket.averageScore < 0.75) {
    return "border-amber-500/30 bg-amber-500/10 text-amber-200";
  }
  return "border-emerald-500/30 bg-emerald-500/10 text-emerald-200";
}

function findMostPracticedBucket(buckets: CoverageBucket[]): CoverageBucket | null {
  return (
    buckets
      .slice()
      .sort((a, b) => {
        if (a.attempts !== b.attempts) return b.attempts - a.attempts;
        return a.id - b.id;
      })[0] ?? null
  );
}

function findWeakestBucket(buckets: CoverageBucket[]): CoverageBucket | null {
  return (
    buckets
      .filter((bucket) => bucket.attempts >= 2)
      .slice()
      .sort((a, b) => {
        if (a.averageScore !== b.averageScore) return a.averageScore - b.averageScore;
        return b.attempts - a.attempts;
      })[0] ?? null
  );
}

function findStrongestBucket(buckets: CoverageBucket[]): CoverageBucket | null {
  return (
    buckets
      .filter((bucket) => bucket.attempts >= 2)
      .slice()
      .sort((a, b) => {
        if (a.averageScore !== b.averageScore) return b.averageScore - a.averageScore;
        return b.attempts - a.attempts;
      })[0] ?? null
  );
}

async function fetchPlayProgress(
  playerId: string | null,
  guestPlayerId: string | null
): Promise<PlayProgressResponse | null> {
  if (!playerId) return null;

  const headers: Record<string, string> = {};
  if (guestPlayerId) {
    headers["X-Guest-Player-Id"] = guestPlayerId;
  }

  const response = await fetch("/api/progress", {
    cache: "no-store",
    headers,
  });

  if (response.status === 401) return null;
  if (!response.ok) {
    throw new Error("Failed to load play progress.");
  }

  return (await response.json()) as PlayProgressResponse;
}

function OverviewCard({
  title,
  value,
  description,
}: {
  title: string;
  value: string;
  description: string;
}) {
  return (
    <div className="rounded-2xl border border-gray-800 bg-gray-900 p-5">
      <p className="text-sm text-gray-500">{title}</p>
      <p className="mt-3 text-3xl font-semibold text-white">{value}</p>
      <p className="mt-2 text-sm text-gray-400">{description}</p>
    </div>
  );
}

function SourceBadge({ source }: { source: SourceState }) {
  return (
    <span
      className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${sourceBadgeClass(source)}`}
    >
      {sourceLabel(source)}
    </span>
  );
}

function CoverageDetailPanel({
  details,
}: {
  details: CoverageBucketDetails | null;
}) {
  if (!details) {
    return (
      <div className="mt-6 rounded-2xl border border-dashed border-gray-700 bg-gray-950 p-6 text-sm text-gray-400">
        Click a highlighted card to see which attempts are contributing to its grade.
      </div>
    );
  }

  return (
    <div className="mt-6 rounded-2xl border border-emerald-500/20 bg-gray-950 p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-sm text-emerald-300/80">Selected coverage card</p>
          <h3 className="mt-1 text-2xl font-semibold text-white">{details.bucket.label}</h3>
          <p className="mt-2 text-sm text-gray-400">
            This grade is based on {details.bucket.attempts} exact attempt(s) with{" "}
            {formatPercent(details.bucket.successRate)} success and an average quality score of{" "}
            {formatScore(details.bucket.averageScore)}.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3 text-sm lg:min-w-80">
          <div className="rounded-xl border border-gray-800 bg-black/20 p-3">
            <p className="text-gray-500">Attempts</p>
            <p className="mt-1 text-xl font-semibold text-white">{details.bucket.attempts}</p>
          </div>
          <div className="rounded-xl border border-gray-800 bg-black/20 p-3">
            <p className="text-gray-500">Success</p>
            <p className="mt-1 text-xl font-semibold text-white">
              {formatPercent(details.bucket.successRate)}
            </p>
          </div>
          <div className="rounded-xl border border-gray-800 bg-black/20 p-3">
            <p className="text-gray-500">Average score</p>
            <p className="mt-1 text-xl font-semibold text-white">
              {formatScore(details.bucket.averageScore)}
            </p>
          </div>
          <div className="rounded-xl border border-gray-800 bg-black/20 p-3">
            <p className="text-gray-500">Last activity</p>
            <p className="mt-1 text-base font-semibold text-white">
              {formatDate(details.bucket.lastActivityAt)}
            </p>
          </div>
        </div>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <div>
          <h4 className="text-sm font-semibold uppercase tracking-wide text-gray-400">
            Grade by mode
          </h4>
          <div className="mt-3 space-y-3">
            {details.modeBreakdown.map((breakdown) => (
              <div
                key={breakdown.mode}
                className="rounded-xl border border-gray-800 bg-black/20 px-4 py-3"
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="font-medium text-white">{breakdown.label}</p>
                  <p className="text-sm text-gray-400">{breakdown.attempts} attempt(s)</p>
                </div>
                <div className="mt-2 flex flex-wrap gap-4 text-sm text-gray-400">
                  <span>Success: {formatPercent(breakdown.successRate)}</span>
                  <span>Average: {formatScore(breakdown.averageScore)}</span>
                  <span>Latest: {formatDate(breakdown.lastActivityAt)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div>
          <h4 className="text-sm font-semibold uppercase tracking-wide text-gray-400">
            Recent contributing attempts
          </h4>
          <div className="mt-3 space-y-3">
            {details.events.slice(0, 8).map((event) => {
              const eventHref = getProgressEventHref(event);

              return (
                <div
                  key={event.id}
                  className="rounded-xl border border-gray-800 bg-black/20 px-4 py-3"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-medium text-white">{MODE_LABELS[event.mode]}</p>
                    <p className="mt-1 text-sm text-gray-400">
                      {formatCoverageEventContext(event)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-base font-semibold text-white">
                      {formatAttemptScore(event)}
                    </p>
                    <p className="mt-1 text-xs text-gray-500">
                      {sourceLabel(event.source)} • {formatDate(event.timestamp)}
                    </p>
                  </div>
                </div>
                {eventHref ? (
                  <div className="mt-3">
                    <Link
                      href={eventHref}
                      className="inline-flex rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm font-medium text-emerald-200 hover:border-emerald-400/50 hover:text-white"
                    >
                      {event.verseKey ? "Open verse in Quran" : "Open in Quran"}
                    </Link>
                  </div>
                ) : null}
              </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

export function ProgressPageClient() {
  const { player, isAuthenticated, isGuest, loading: authLoading } = useAuth();
  const [dashboard, setDashboard] = useState<ProgressDashboard | null>(null);
  const [coverageTab, setCoverageTab] = useState<CoverageDimension>("juz");
  const [selectedCoverageModes, setSelectedCoverageModes] =
    useState<DashboardMode[]>(COVERAGE_FILTER_MODES);
  const [selectedCoverageBucketId, setSelectedCoverageBucketId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) return;

    let cancelled = false;

    async function loadDashboard() {
      setLoading(true);
      setError(null);

      try {
        await migrateFromLocalStorage();

        const guestPlayerId = isGuest && player ? player.id : null;
        const [flashcards, reviews, dueCount, newCount, memorizationAttempts, play] =
          await Promise.all([
            getFlashcards(),
            getReviewLog(),
            getDueCardsCount(),
            getNewCardsCount(),
            getMemorizationAttempts(),
            fetchPlayProgress(player?.id ?? null, guestPlayerId),
          ]);

        if (cancelled) return;

        setDashboard(
          buildProgressDashboard({
            isAuthenticated,
            hasPlayer: Boolean(player),
            play,
            flashcards,
            reviews,
            dueCount,
            newCount,
            memorizationAttempts,
          })
        );
      } catch (loadError) {
        if (cancelled) return;
        setDashboard(null);
        setError(
          loadError instanceof Error
            ? loadError.message
            : "We could not build your progress dashboard."
        );
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadDashboard();

    return () => {
      cancelled = true;
    };
  }, [authLoading, isAuthenticated, isGuest, player]);

  if (authLoading || (loading && !dashboard)) {
    return (
      <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center bg-gray-950 px-4 text-white">
        <div className="text-center">
          <div className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-emerald-500 border-t-transparent" />
          <p className="mt-4 text-sm text-gray-400">Building your progress dashboard...</p>
        </div>
      </div>
    );
  }

  if (!dashboard) {
    return (
      <div className="min-h-[calc(100vh-4rem)] bg-gray-950 px-4 py-12 text-white">
        <div className="mx-auto max-w-4xl rounded-3xl border border-red-900/50 bg-red-950/20 p-8">
          <h1 className="text-3xl font-bold">Progress</h1>
          <p className="mt-3 text-red-200">{error ?? "The dashboard could not be loaded."}</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/train"
              className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500"
            >
              Open training
            </Link>
            <Link
              href="/play"
              className="rounded-xl border border-gray-700 px-4 py-2 text-sm font-medium text-gray-200 hover:border-gray-500 hover:text-white"
            >
              Open play
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const filteredCoverageEvents = filterProgressEventsByModes(
    dashboard.events,
    selectedCoverageModes
  );
  const filteredCoverage = {
    juz: buildCoverageBuckets(filteredCoverageEvents, "juz"),
    surah: buildCoverageBuckets(filteredCoverageEvents, "surah"),
    page: buildCoverageBuckets(filteredCoverageEvents, "page"),
  };
  const selectedBuckets = filteredCoverage[coverageTab];
  const coverageMap = new Map(selectedBuckets.map((bucket) => [bucket.id, bucket]));
  const activeCoverageBucketId =
    selectedCoverageBucketId !== null && coverageMap.has(selectedCoverageBucketId)
      ? selectedCoverageBucketId
      : null;
  const selectedCoverageDetails =
    activeCoverageBucketId !== null
      ? buildCoverageBucketDetails(filteredCoverageEvents, coverageTab, activeCoverageBucketId)
      : null;
  const mostPracticedBucket = findMostPracticedBucket(selectedBuckets);
  const weakestBucket = findWeakestBucket(selectedBuckets);
  const strongestBucket = findStrongestBucket(selectedBuckets);
  const isEmpty =
    dashboard.overview.totalAttempts === 0 &&
    dashboard.flashcards.totalCards === 0 &&
    dashboard.hotspots.length === 0;

  const strongestModeLabel = dashboard.overview.strongestMode
    ? MODE_LABELS[dashboard.overview.strongestMode]
    : "Need more data";
  const weakestModeLabel = dashboard.overview.weakestMode
    ? MODE_LABELS[dashboard.overview.weakestMode]
    : "Need more data";

  const sourceSummary = player
    ? isAuthenticated
      ? "Your play, flashcards, and memorization stats are being pulled together as synced data."
      : "Your guest play and memorization history are synced to your guest profile, while flashcards stay on this device."
    : "You can already reflect on local training progress here. Start a play session or sign in to add synced multiplayer history.";

  const selectedCoverageModeLabels = selectedCoverageModes
    .map((mode) => MODE_LABELS[mode])
    .join(", ");

  function handleCoverageTabChange(tab: CoverageDimension) {
    setCoverageTab(tab);
    setSelectedCoverageBucketId(null);
  }

  function handleCoverageModeToggle(mode: DashboardMode) {
    setSelectedCoverageBucketId(null);
    setSelectedCoverageModes((current) => {
      if (current.includes(mode)) {
        if (current.length === 1) return current;
        return current.filter((item) => item !== mode);
      }

      return [...current, mode];
    });
  }

  function handleResetCoverageModes() {
    setSelectedCoverageBucketId(null);
    setSelectedCoverageModes(COVERAGE_FILTER_MODES);
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-gray-950 px-4 py-12 text-white">
      <div className="mx-auto max-w-6xl space-y-8">
        <section className="rounded-3xl border border-gray-800 bg-gradient-to-br from-emerald-950/50 via-gray-900 to-gray-900 p-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-3xl font-bold sm:text-4xl">Global Progress</h1>
                <SourceBadge source={dashboard.sources.overall} />
              </div>
              <p className="mt-4 max-w-2xl text-sm leading-7 text-gray-300 sm:text-base">
                One place to reflect on every active play and training mode: multiple choice,
                word meaning, fill in the blank, trivia, flashcards, and memorization tester.
              </p>
              <p className="mt-3 text-sm text-gray-400">{sourceSummary}</p>
            </div>

            <div className="rounded-2xl border border-emerald-500/20 bg-black/20 p-5 lg:min-w-72">
              <p className="text-sm text-emerald-200/80">Current profile</p>
              <p className="mt-2 text-2xl font-semibold text-white">
                {dashboard.player?.display_name ?? "Local reflection"}
              </p>
              <p className="mt-2 text-sm text-gray-400">
                {dashboard.player
                  ? `${dashboard.player.total_points} points and ${dashboard.player.total_wins} wins tracked so far.`
                  : "Training activity is available even before you create or sign in to a synced profile."}
              </p>
              <div className="mt-5 flex flex-wrap gap-3">
                <Link
                  href="/play"
                  className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500"
                >
                  Play modes
                </Link>
                <Link
                  href="/train"
                  className="rounded-xl border border-gray-700 px-4 py-2 text-sm font-medium text-gray-200 hover:border-gray-500 hover:text-white"
                >
                  Training
                </Link>
              </div>
            </div>
          </div>
        </section>

        {!player && (
          <section className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-5">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-amber-100">Play stats are not attached yet</h2>
                <p className="mt-1 text-sm text-amber-200/80">
                  Training data works locally right away. Start a play session as a guest or sign in to
                  add synced play history and verse hotspots here.
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                <Link
                  href="/play"
                  className="rounded-xl bg-amber-400 px-4 py-2 text-sm font-medium text-gray-950 hover:bg-amber-300"
                >
                  Start play
                </Link>
                <Link
                  href="/login?next=/progress"
                  className="rounded-xl border border-amber-300/40 px-4 py-2 text-sm font-medium text-amber-100 hover:border-amber-200 hover:text-white"
                >
                  Sign in
                </Link>
              </div>
            </div>
          </section>
        )}

        {isEmpty && (
          <section className="rounded-3xl border border-gray-800 bg-gray-900 p-8">
            <h2 className="text-2xl font-semibold text-white">Your dashboard is ready for its first session</h2>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-gray-400">
              As soon as you review flashcards, rate a memorization prompt, or play a round, this page
              will start showing accuracy, weak spots, Quran coverage, and the next best place to focus.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                href="/train/flashcards"
                className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500"
              >
                Start flashcards
              </Link>
              <Link
                href="/train/memorization-tester"
                className="rounded-xl border border-gray-700 px-4 py-2 text-sm font-medium text-gray-200 hover:border-gray-500 hover:text-white"
              >
                Open memorization tester
              </Link>
              <Link
                href="/play"
                className="rounded-xl border border-gray-700 px-4 py-2 text-sm font-medium text-gray-200 hover:border-gray-500 hover:text-white"
              >
                Start play mode
              </Link>
            </div>
          </section>
        )}

        <section>
          <div className="mb-4">
            <h2 className="text-2xl font-semibold text-white">Overview</h2>
            <p className="mt-1 text-sm text-gray-400">
              The quickest way to understand your overall pace, consistency, and confidence.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <OverviewCard
              title="Total activity"
              value={dashboard.overview.totalAttempts.toLocaleString()}
              description={`${dashboard.overview.activeDays} active day(s) across play and training.`}
            />
            <OverviewCard
              title="Accuracy and retention"
              value={formatPercent(dashboard.overview.successRate)}
              description={`Average quality score: ${formatScore(dashboard.overview.averageScore)}.`}
            />
            <OverviewCard
              title="Consistency"
              value={`${dashboard.overview.streakDays} day(s)`}
              description={`You have shown up on ${dashboard.overview.activeDays} distinct day(s).`}
            />
            <OverviewCard
              title="Strongest and weakest"
              value={strongestModeLabel}
              description={`Needs the most support: ${weakestModeLabel}.`}
            />
          </div>
        </section>

        <section>
          <div className="mb-4">
            <h2 className="text-2xl font-semibold text-white">Mode by mode</h2>
            <p className="mt-1 text-sm text-gray-400">
              Compare how you are doing in each game and training mode without losing the source context.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {dashboard.modeSummaries.map((summary) => {
              const isStrongest = dashboard.overview.strongestMode === summary.mode;
              const isWeakest = dashboard.overview.weakestMode === summary.mode;
              const borderClass = isStrongest
                ? "border-emerald-500/40"
                : isWeakest
                ? "border-red-500/40"
                : "border-gray-800";

              return (
                <div key={summary.mode} className={`rounded-2xl border bg-gray-900 p-5 ${borderClass}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-lg font-semibold text-white">{summary.label}</h3>
                      <p className="mt-1 text-sm text-gray-500">
                        Last activity: {formatDate(summary.lastActivityAt)}
                      </p>
                    </div>
                    <SourceBadge source={summary.source} />
                  </div>

                  <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
                    <div className="rounded-xl border border-gray-800 bg-gray-950 p-3">
                      <p className="text-gray-500">Attempts</p>
                      <p className="mt-1 text-xl font-semibold text-white">{summary.attempts}</p>
                    </div>
                    <div className="rounded-xl border border-gray-800 bg-gray-950 p-3">
                      <p className="text-gray-500">Success</p>
                      <p className="mt-1 text-xl font-semibold text-white">
                        {formatPercent(summary.successRate)}
                      </p>
                    </div>
                    <div className="rounded-xl border border-gray-800 bg-gray-950 p-3">
                      <p className="text-gray-500">Average score</p>
                      <p className="mt-1 text-xl font-semibold text-white">
                        {formatScore(summary.averageScore)}
                      </p>
                    </div>
                    <div className="rounded-xl border border-gray-800 bg-gray-950 p-3">
                      <p className="text-gray-500">Points</p>
                      <p className="mt-1 text-xl font-semibold text-white">{summary.totalPoints}</p>
                    </div>
                  </div>

                  <div className="mt-5 flex items-center justify-between gap-3">
                    <p className="text-xs text-gray-500">
                      {isStrongest
                        ? "This is currently your strongest tracked mode."
                        : isWeakest
                        ? "This mode is the clearest opportunity for improvement."
                        : "Keep feeding this mode with regular sessions to improve the trend line."}
                    </p>
                    <Link
                      href={MODE_LINKS[summary.mode]}
                      className="shrink-0 rounded-xl border border-gray-700 px-3 py-2 text-sm font-medium text-gray-200 hover:border-gray-500 hover:text-white"
                    >
                      Open
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section className="rounded-3xl border border-gray-800 bg-gray-900 p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h2 className="text-2xl font-semibold text-white">Quran coverage</h2>
              <p className="mt-2 max-w-3xl text-sm leading-7 text-gray-400">
                See which parts of the Quran you have actually tested yourself in across play,
                flashcards, and memorization. Only exact verse, surah, juz, and page attribution is
                shown here. Trivia stays in the overview but is intentionally excluded from the map.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {COVERAGE_TABS.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => handleCoverageTabChange(tab.id)}
                  className={`rounded-xl px-4 py-2 text-sm font-medium transition-colors ${
                    coverageTab === tab.id
                      ? "bg-emerald-600 text-white"
                      : "border border-gray-700 bg-gray-950 text-gray-300 hover:border-gray-500 hover:text-white"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-6 rounded-2xl border border-gray-800 bg-gray-950 p-4">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-400">
                  Filter by mode
                </h3>
                <p className="mt-2 text-sm text-gray-400">
                  Coverage grades currently reflect: {selectedCoverageModeLabels}.
                </p>
              </div>
              <button
                type="button"
                onClick={handleResetCoverageModes}
                className="rounded-xl border border-gray-700 px-3 py-2 text-sm font-medium text-gray-300 hover:border-gray-500 hover:text-white"
              >
                Reset to all modes
              </button>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {COVERAGE_FILTER_MODES.map((mode) => {
                const active = selectedCoverageModes.includes(mode);

                return (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => handleCoverageModeToggle(mode)}
                    className={`rounded-full border px-3 py-2 text-sm font-medium transition-colors ${
                      active
                        ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-200"
                        : "border-gray-700 bg-gray-900 text-gray-400 hover:border-gray-500 hover:text-white"
                    }`}
                  >
                    {MODE_LABELS[mode]}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-3">
            <div className="rounded-2xl border border-gray-800 bg-gray-950 p-4">
              <p className="text-sm text-gray-500">
                Covered {COVERAGE_TABS.find((tab) => tab.id === coverageTab)?.label}
              </p>
              <p className="mt-2 text-3xl font-semibold text-white">
                {selectedBuckets.length}/{getCoverageRange(coverageTab)}
              </p>
              <p className="mt-2 text-sm text-gray-400">
                Distinct areas with exact activity attached.
              </p>
            </div>
            <div className="rounded-2xl border border-gray-800 bg-gray-950 p-4">
              <p className="text-sm text-gray-500">Most practiced</p>
              <p className="mt-2 text-xl font-semibold text-white">
                {mostPracticedBucket?.label ?? "No exact coverage yet"}
              </p>
              <p className="mt-2 text-sm text-gray-400">
                {mostPracticedBucket
                  ? `${mostPracticedBucket.attempts} attempt(s) at ${formatPercent(mostPracticedBucket.successRate)} success.`
                  : "Start a non-trivia play round, rate memorization prompts, or review attributed flashcards."}
              </p>
            </div>
            <div className="rounded-2xl border border-gray-800 bg-gray-950 p-4">
              <p className="text-sm text-gray-500">Reflection focus</p>
              <p className="mt-2 text-xl font-semibold text-white">
                {weakestBucket?.label ?? strongestBucket?.label ?? "Need more attempts"}
              </p>
              <p className="mt-2 text-sm text-gray-400">
                {weakestBucket
                  ? `This is your weakest exact-location area right now at ${formatScore(weakestBucket.averageScore)}.`
                  : strongestBucket
                  ? `Best-performing mapped area so far: ${formatScore(strongestBucket.averageScore)}.`
                  : "Once you have at least a couple of attempts in one area, this section will point out where to return next."}
              </p>
            </div>
          </div>

          {selectedBuckets.length > 0 ? (
            <div className="mt-6 rounded-2xl border border-gray-800 bg-black/20 p-4">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-gray-400">
                  Click any highlighted card to inspect the attempts behind its grade.
                </p>
                <p className="text-xs text-gray-500">
                  Empty cards mean no exact-location attempts for the current filter.
                </p>
              </div>
              <div className="grid grid-cols-5 gap-2 sm:grid-cols-8 lg:grid-cols-10 xl:grid-cols-12">
                {Array.from({ length: getCoverageRange(coverageTab) }, (_, index) => {
                  const id = index + 1;
                  const bucket = coverageMap.get(id);
                  const isActive = activeCoverageBucketId === id;

                  return (
                    <button
                      key={`${coverageTab}-${id}`}
                      type="button"
                      disabled={!bucket}
                      onClick={() => setSelectedCoverageBucketId(id)}
                      title={
                        bucket
                          ? `${bucket.label}: ${bucket.attempts} attempts, ${formatPercent(bucket.successRate)} success`
                          : `${getCoverageLabel(coverageTab, id)}: no exact data yet`
                      }
                      className={`rounded-xl border px-2 py-2 text-center text-xs transition-transform ${
                        coverageTone(bucket)
                      } ${bucket ? "cursor-pointer hover:scale-[1.03]" : "cursor-not-allowed"} ${
                        isActive ? "ring-2 ring-emerald-400 ring-offset-2 ring-offset-gray-900" : ""
                      }`}
                    >
                      <div className="font-semibold">
                        {coverageTab === "surah" ? `#${id}` : id}
                      </div>
                      {coverageTab === "surah" ? (
                        <div className="mt-1 truncate text-[10px] opacity-80">
                          {getCoverageLabel("surah", id)}
                        </div>
                      ) : null}
                      <div className="mt-1 text-[11px] opacity-80">
                        {bucket ? `${Math.round(bucket.averageScore * 100)}%` : "0%"}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="mt-6 rounded-2xl border border-dashed border-gray-700 bg-gray-950 p-6 text-sm text-gray-400">
              No exact Quran-location coverage has been recorded yet for this view.
            </div>
          )}

          <CoverageDetailPanel details={selectedCoverageDetails} />
        </section>

        <div className="grid gap-6 lg:grid-cols-2">
          <section className="rounded-3xl border border-gray-800 bg-gray-900 p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-2xl font-semibold text-white">Flashcards snapshot</h2>
                <p className="mt-2 text-sm text-gray-400">
                  A concise summary of your spaced-repetition health, with a shortcut to the existing
                  detailed flashcard stats page.
                </p>
              </div>
              <SourceBadge source={dashboard.flashcards.source} />
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-gray-800 bg-gray-950 p-4">
                <p className="text-sm text-gray-500">Total cards</p>
                <p className="mt-2 text-3xl font-semibold text-white">{dashboard.flashcards.totalCards}</p>
              </div>
              <div className="rounded-2xl border border-gray-800 bg-gray-950 p-4">
                <p className="text-sm text-gray-500">Retention</p>
                <p className="mt-2 text-3xl font-semibold text-white">
                  {formatPercent(dashboard.flashcards.retentionRate)}
                </p>
              </div>
              <div className="rounded-2xl border border-gray-800 bg-gray-950 p-4">
                <p className="text-sm text-gray-500">Due now</p>
                <p className="mt-2 text-3xl font-semibold text-emerald-300">
                  {dashboard.flashcards.dueCount}
                </p>
              </div>
              <div className="rounded-2xl border border-gray-800 bg-gray-950 p-4">
                <p className="text-sm text-gray-500">New cards</p>
                <p className="mt-2 text-3xl font-semibold text-blue-300">
                  {dashboard.flashcards.newCount}
                </p>
              </div>
              <div className="rounded-2xl border border-gray-800 bg-gray-950 p-4">
                <p className="text-sm text-gray-500">Mature cards</p>
                <p className="mt-2 text-3xl font-semibold text-white">
                  {dashboard.flashcards.matureCards}
                </p>
              </div>
              <div className="rounded-2xl border border-gray-800 bg-gray-950 p-4">
                <p className="text-sm text-gray-500">Learning now</p>
                <p className="mt-2 text-3xl font-semibold text-white">
                  {dashboard.flashcards.learningCards}
                </p>
              </div>
            </div>

            <p className="mt-4 text-sm text-gray-400">
              {dashboard.flashcards.reviews} total review event(s) have been folded into this global
              dashboard.
            </p>

            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                href="/train/flashcards/stats"
                className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500"
              >
                Open flashcard statistics
              </Link>
              <Link
                href="/train/flashcards"
                className="rounded-xl border border-gray-700 px-4 py-2 text-sm font-medium text-gray-200 hover:border-gray-500 hover:text-white"
              >
                Open flashcards
              </Link>
            </div>
          </section>

          <section className="rounded-3xl border border-gray-800 bg-gray-900 p-6">
            <h2 className="text-2xl font-semibold text-white">Insights and next steps</h2>
            <p className="mt-2 text-sm text-gray-400">
              Suggestions are generated from weak modes, exact Quran coverage, due flashcards, and play hotspots.
            </p>

            {dashboard.insights.length > 0 ? (
              <div className="mt-6 space-y-3">
                {dashboard.insights.map((insight, index) => (
                  <div
                    key={insight.id}
                    className={`rounded-2xl border p-4 ${
                      index === 0
                        ? "border-emerald-500/30 bg-emerald-500/10"
                        : "border-gray-800 bg-gray-950"
                    }`}
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="text-lg font-semibold text-white">{insight.title}</p>
                        <p className="mt-2 text-sm leading-7 text-gray-300">{insight.description}</p>
                      </div>
                      {insight.href && insight.ctaLabel ? (
                        <Link
                          href={insight.href}
                          className="shrink-0 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm font-medium text-white hover:bg-white/10"
                        >
                          {insight.ctaLabel}
                        </Link>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="mt-6 rounded-2xl border border-dashed border-gray-700 bg-gray-950 p-5 text-sm text-gray-400">
                Add a few sessions in play or training and this area will start highlighting your next best action.
              </div>
            )}

            {dashboard.hotspots.length > 0 ? (
              <div className="mt-6">
                <h3 className="text-lg font-semibold text-white">Most-missed verses in play</h3>
                <div className="mt-3 space-y-3">
                  {dashboard.hotspots.slice(0, 5).map((hotspot) => (
                    <div
                      key={hotspot.verse_key}
                      className="flex items-center justify-between gap-4 rounded-2xl border border-gray-800 bg-gray-950 px-4 py-3"
                    >
                      <div>
                        <p className="font-medium text-white">{hotspot.verse_key}</p>
                        <p className="mt-1 text-sm text-gray-400">
                          Last missed on {formatDate(hotspot.last_mistake_at)}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-xl font-semibold text-red-300">{hotspot.mistake_count}</p>
                        <p className="text-xs text-gray-500">mistake(s)</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </section>
        </div>
      </div>
    </div>
  );
}
