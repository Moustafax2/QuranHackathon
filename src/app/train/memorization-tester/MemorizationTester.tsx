"use client";

import { useState, useEffect, useCallback } from "react";
import { CHAPTERS_DATA } from "@/lib/data/chapters-data";
import { addRating, getSurahScores, clearAllRecords, type RatingLevel } from "@/lib/memorization/storage";
import type { AyahQuestion, PageBlankQuestion, MemorizationQuestion } from "@/lib/memorization/types";

type Mode = "ayah" | "page-blank";
type SelectionType = "juz" | "surah";
type Phase = "setup" | "testing";

// Mushaf page images — sourced from the quran.com CDN (files.quran.app)
function mushafPageUrl(page: number): string {
  return `https://files.quran.app/hafs/madani/width_1260/page${String(page).padStart(3, "0")}.png`;
}

const JUZ_COUNT = 30;
const SURAH_COUNT = 114;
const TESTING_HISTORY_FLAG = "memorizationTesterTesting";

// ── Heat map color ──────────────────────────────────────────────────────────

function scoreToColor(score: number | undefined): string {
  if (score === undefined) return "bg-gray-800";
  if (score < 0.5) return "bg-red-700/70";
  if (score < 1.5) return "bg-yellow-600/70";
  return "bg-emerald-700/70";
}

function isTestingHistoryState(state: unknown): boolean {
  return Boolean(
    state &&
    typeof state === "object" &&
    TESTING_HISTORY_FLAG in state &&
    (state as Record<string, unknown>)[TESTING_HISTORY_FLAG] === true
  );
}

// ── Heatmap reset warning modal ────────────────────────────────────────────

function HeatmapResetModal({
  onConfirm,
  onCancel,
}: {
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const [confirmed, setConfirmed] = useState(false);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm px-4">
      <div className="w-full max-w-md rounded-2xl border border-red-900/60 bg-gray-900 p-6 shadow-2xl">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-500/20 text-xl">
            🗑️
          </div>
          <h2 className="text-lg font-bold text-white">Reset Heatmap Data?</h2>
        </div>

        <div className="mb-5 space-y-2 rounded-xl border border-red-900/40 bg-red-950/30 p-4 text-sm text-red-200/80">
          <p className="font-semibold text-red-300">This will permanently delete:</p>
          <ul className="ml-4 list-disc space-y-1.5 text-red-200/70">
            <li>All your <strong>ayah ratings</strong> (Wrong / Medium / Correct)</li>
            <li>All <strong>surah performance scores</strong> shown on the heatmap</li>
          </ul>
          <p className="mt-2 font-medium text-red-300/90">This cannot be undone.</p>
        </div>

        <label className="mb-5 flex cursor-pointer items-start gap-3 rounded-xl border border-gray-700 bg-gray-800 p-4">
          <input
            type="checkbox"
            checked={confirmed}
            onChange={(e) => setConfirmed(e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-gray-600 bg-gray-700 text-red-500 focus:ring-red-500"
          />
          <span className="text-sm text-gray-300">
            I understand this will permanently delete all my memorization ratings and cannot be undone.
          </span>
        </label>

        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 rounded-xl border border-gray-700 bg-gray-800 px-4 py-2.5 text-sm font-medium text-gray-300 hover:bg-gray-700"
          >
            Cancel
          </button>
          <button
            disabled={!confirmed}
            onClick={onConfirm}
            className="flex-1 rounded-xl bg-red-700 px-4 py-2.5 text-sm font-semibold text-white transition-all hover:bg-red-600 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Reset heatmap
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────

export function MemorizationTester() {
  const [phase, setPhase] = useState<Phase>("setup");
  const [mode, setMode] = useState<Mode>("ayah");
  const [selectionType, setSelectionType] = useState<SelectionType>("juz");
  const [selectedIds, setSelectedIds] = useState<Set<number>>(
    () => new Set(Array.from({ length: JUZ_COUNT }, (_, i) => i + 1))
  );
  const [difficulty, setDifficulty] = useState<"easy" | "medium" | "hard">("medium");
  const [showReference, setShowReference] = useState(false);
  const [currentQuestion, setCurrentQuestion] = useState<MemorizationQuestion | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [history, setHistory] = useState<MemorizationQuestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [surahScores, setSurahScores] = useState<Record<number, number>>({});
  const [imageLoaded, setImageLoaded] = useState(false);
  const [areSettingsMinimized, setAreSettingsMinimized] = useState(true);
  const [showHeatmapReset, setShowHeatmapReset] = useState(false);

  // Load heat map data on mount and after ratings
  useEffect(() => {
    setSurahScores(getSurahScores());
  }, []);

  // When switching selectionType, reset selectedIds to all
  const handleSelectionTypeChange = (t: SelectionType) => {
    setSelectionType(t);
    const count = t === "juz" ? JUZ_COUNT : SURAH_COUNT;
    setSelectedIds(new Set(Array.from({ length: count }, (_, i) => i + 1)));
  };

  const toggleId = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const selectAll = () => {
    const count = selectionType === "juz" ? JUZ_COUNT : SURAH_COUNT;
    setSelectedIds(new Set(Array.from({ length: count }, (_, i) => i + 1)));
  };

  const clearAll = () => setSelectedIds(new Set());

  const fetchQuestion = useCallback(async () => {
    if (selectedIds.size === 0) return;
    setLoading(true);
    setError(null);
    setRevealed(false);
    setImageLoaded(false);

    const params = new URLSearchParams({
      mode,
      selectionType,
      selectionIds: [...selectedIds].join(","),
      difficulty,
    });

    try {
      const res = await fetch(`/api/memorization/question?${params}`);
      if (!res.ok) throw new Error("Failed to fetch question");
      const q = (await res.json()) as MemorizationQuestion;
      setCurrentQuestion((prev) => {
        if (prev) setHistory((h) => [...h.slice(-9), prev]);
        return q;
      });
    } catch {
      setError("Could not load question. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [mode, selectionType, selectedIds, difficulty]);

  const handleStart = async () => {
    if (typeof window !== "undefined" && !isTestingHistoryState(window.history.state)) {
      window.history.pushState(
        { ...(window.history.state ?? {}), [TESTING_HISTORY_FLAG]: true },
        "",
        window.location.href
      );
    }
    setPhase("testing");
    await fetchQuestion();
  };

  const resetTestingView = useCallback(() => {
    setPhase("setup");
    setRevealed(false);
    setImageLoaded(false);
    setError(null);
  }, []);

  const handleExitTesting = useCallback(() => {
    if (typeof window !== "undefined" && isTestingHistoryState(window.history.state)) {
      window.history.back();
      return;
    }

    resetTestingView();
  }, [resetTestingView]);

  const handleUndo = () => {
    if (history.length === 0) return;
    const prev = history[history.length - 1];
    setHistory((h) => h.slice(0, -1));
    setCurrentQuestion(prev);
    setRevealed(false);
    setImageLoaded(false);
    setError(null);
  };

  const handleRate = useCallback((level: RatingLevel) => {
    if (!currentQuestion) return;
    if (currentQuestion.mode === "ayah") {
      const q = currentQuestion as AyahQuestion;
      addRating(q.verseKey, q.surahId, level, {
        pageNumber: q.pageNumber,
        juzNumber: q.juzNumber,
      });
    } else {
      // For page-blank, we don't have a single verse key — skip storing per-verse
      // Could be extended later to store page-level data
    }
    setSurahScores(getSurahScores());
    fetchQuestion();
  }, [currentQuestion, fetchQuestion]);

  useEffect(() => {
    if (phase !== "testing") return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (isTypingTarget(event.target)) return;
      if (loading || error || !currentQuestion) return;

      if (revealed) {
        if (event.key === "1") {
          event.preventDefault();
          handleRate(0);
          return;
        }
        if (event.key === "2") {
          event.preventDefault();
          handleRate(1);
          return;
        }
        if (event.key === "3") {
          event.preventDefault();
          handleRate(2);
          return;
        }
        if (event.key === " ") {
          event.preventDefault();
          fetchQuestion();
        }
        return;
      }

      if (event.key === " ") {
        event.preventDefault();
        setRevealed(true);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [currentQuestion, error, fetchQuestion, handleRate, loading, phase, revealed]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const handlePopState = (event: PopStateEvent) => {
      if (phase === "testing" && !isTestingHistoryState(event.state)) {
        resetTestingView();
      }
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [phase, resetTestingView]);

  const pageClass = "bg-black text-white";
  const cardClass = "border-gray-800 bg-gray-900";
  const mutedTextClass = "text-gray-400";
  const subtleTextClass = "text-gray-500";
  const controlClass = "bg-gray-800 text-gray-400 hover:bg-gray-700";
  const ghostButtonClass = "border-gray-700 text-gray-400 hover:border-gray-500 hover:text-white";

  // ── Setup Screen ────────────────────────────────────────────────────────

  if (phase === "setup") {
    return (
      <div className={`mx-auto max-w-3xl rounded-3xl px-4 py-10 ${pageClass}`}>
        {showHeatmapReset && (
          <HeatmapResetModal
            onConfirm={() => {
              clearAllRecords();
              setSurahScores({});
              setShowHeatmapReset(false);
            }}
            onCancel={() => setShowHeatmapReset(false)}
          />
        )}
        <div className="mb-8">
          <h1 className="text-2xl font-bold">Memorization Tester</h1>
          <p className={`mt-1 text-sm ${mutedTextClass}`}>
            Test your hifz with mushaf pages or individual ayahs.
          </p>
        </div>

        {/* Mode selection */}
        <section className="mb-8">
          <h2 className={`mb-3 text-sm font-semibold uppercase tracking-wider ${subtleTextClass}`}>Mode</h2>
          <div className="grid grid-cols-2 gap-3">
            {(["page-blank", "ayah"] as Mode[]).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`rounded-xl border p-4 text-left transition-all ${
                  mode === m
                    ? "border-emerald-500 bg-emerald-900/20"
                    : "border-gray-700 bg-gray-900 hover:border-gray-600"
                }`}
              >
                <div className="text-lg mb-1">{m === "page-blank" ? "📄" : "🔍"}</div>
                <div className="font-semibold text-sm">
                  {m === "page-blank" ? "Page Blank" : "Ayah Mode"}
                </div>
                <div className={`mt-0.5 text-xs leading-relaxed ${mutedTextClass}`}>
                  {m === "page-blank"
                    ? "A mushaf page is shown with a section covered. Reveal to see the full page."
                    : "An ayah is shown (or part of one). Reveal shows the full page with the ayah highlighted."}
                </div>
              </button>
            ))}
          </div>
        </section>

        {/* Selection */}
        <section className="mb-8">
          <h2 className={`mb-3 text-sm font-semibold uppercase tracking-wider ${subtleTextClass}`}>
            Restrict to
          </h2>
          <div className="flex gap-2 mb-4">
            {(["juz", "surah"] as SelectionType[]).map((t) => (
              <button
                key={t}
                onClick={() => handleSelectionTypeChange(t)}
                className={`rounded-lg px-4 py-1.5 text-sm font-medium transition-all ${
                  selectionType === t
                    ? "bg-emerald-600 text-white"
                    : controlClass
                }`}
              >
                {t === "juz" ? "By Juz" : "By Surah"}
              </button>
            ))}
          </div>

          <div className="flex gap-2 mb-3">
            <button
              onClick={selectAll}
              className="text-xs text-emerald-400 hover:text-emerald-300 underline"
            >
              Select All
            </button>
            <span className="text-gray-700">·</span>
            <button
              onClick={clearAll}
              className={`text-xs underline ${mutedTextClass} hover:text-inherit`}
            >
              Clear All
            </button>
            <span className={`ml-auto text-xs ${subtleTextClass}`}>{selectedIds.size} selected</span>
          </div>

          {selectionType === "juz" ? (
            <div className="grid grid-cols-6 gap-1.5">
              {Array.from({ length: JUZ_COUNT }, (_, i) => i + 1).map((juz) => (
                <button
                  key={juz}
                  onClick={() => toggleId(juz)}
                  className={`rounded-md py-1.5 text-xs font-medium transition-all ${
                    selectedIds.has(juz)
                      ? "bg-emerald-700 text-white"
                      : controlClass
                  }`}
                >
                  {juz}
                </button>
              ))}
            </div>
          ) : (
            <div className={`max-h-60 overflow-y-auto rounded-lg border ${cardClass}`}>
              {CHAPTERS_DATA.map((ch) => (
                <button
                  key={ch.id}
                  onClick={() => toggleId(ch.id)}
                  className={`flex w-full items-center gap-3 px-3 py-2 text-left text-sm transition-colors border-b border-gray-800/50 last:border-0 ${
                    selectedIds.has(ch.id)
                      ? "bg-emerald-900/20 text-white"
                      : "text-gray-400 hover:bg-gray-800"
                  }`}
                >
                  <span
                    className={`flex-shrink-0 h-4 w-4 rounded border flex items-center justify-center ${
                      selectedIds.has(ch.id)
                        ? "border-emerald-500 bg-emerald-600"
                        : "border-gray-600"
                    }`}
                  >
                    {selectedIds.has(ch.id) && (
                      <svg className="h-2.5 w-2.5 text-white" fill="currentColor" viewBox="0 0 12 12">
                        <path d="M10 3L5 8.5 2 5.5" stroke="white" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    )}
                  </span>
                  <span className={`w-5 text-xs font-medium ${subtleTextClass}`}>{ch.id}</span>
                  <span>{ch.name_simple}</span>
                  <span className={`ml-auto text-xs ${subtleTextClass}`}>{ch.name_arabic}</span>
                </button>
              ))}
            </div>
          )}
        </section>

        {/* Difficulty — ayah mode only */}
        {mode === "ayah" && (
          <section className="mb-8">
            <div className="flex items-center gap-2 mb-3">
              <h2 className={`text-sm font-semibold uppercase tracking-wider ${subtleTextClass}`}>
                Difficulty
              </h2>
              <div className="relative group">
                <button
                  type="button"
                  className={`flex h-4 w-4 items-center justify-center rounded-full border text-xs ${subtleTextClass} border-gray-700 hover:border-gray-500`}
                  aria-label="Difficulty info"
                >
                  ?
                </button>
                <div className="pointer-events-none absolute left-1/2 top-5 z-10 w-56 -translate-x-1/2 rounded-lg border border-gray-700 bg-gray-900 p-3 text-xs text-gray-300 opacity-0 shadow-lg transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
                  <p className="mb-1.5"><span className="font-semibold text-white">Easy</span> — show the full ayah</p>
                  <p className="mb-1.5"><span className="font-semibold text-white">Medium</span> — show the first half</p>
                  <p><span className="font-semibold text-white">Hard</span> — show only enough words to identify the ayah uniquely</p>
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              {(["easy", "medium", "hard"] as const).map((d) => (
                <button
                  key={d}
                  onClick={() => setDifficulty(d)}
                  className={`rounded-lg px-4 py-1.5 text-sm font-medium capitalize transition-all ${
                    difficulty === d
                      ? d === "hard"
                        ? "bg-red-700 text-white"
                        : d === "easy"
                        ? "bg-emerald-600 text-white"
                        : "bg-emerald-600 text-white"
                      : controlClass
                  }`}
                >
                  {d}
                </button>
              ))}
            </div>
          </section>
        )}

        {/* Settings */}
        <section className="mb-8">
          <button
            type="button"
            onClick={() => setAreSettingsMinimized((prev) => !prev)}
            aria-expanded={!areSettingsMinimized}
            className="flex w-full items-center justify-between rounded-xl border border-gray-800 bg-gray-900 px-4 py-3 text-left transition-colors hover:bg-gray-800"
          >
            <h2 className={`text-sm font-semibold uppercase tracking-wider ${subtleTextClass}`}>Settings</h2>
            <span className={`text-xs ${mutedTextClass}`}>
              {areSettingsMinimized ? "Show" : "Hide"}
            </span>
          </button>

          {!areSettingsMinimized && (
            <div className="space-y-3 pt-3">
              <ToggleRow
                label="Show reference info"
                description="Show surah name and ayah number"
                value={showReference}
                onChange={setShowReference}
              />
              <button
                onClick={() => setShowHeatmapReset(true)}
                className="w-full rounded-lg border border-red-900/50 bg-red-950/20 px-4 py-3 text-left transition-all hover:border-red-700 hover:bg-red-950/40"
              >
                <div className="text-sm font-medium text-red-400">Reset Heatmap</div>
                <div className="text-xs text-red-500/70">Delete all memorization ratings and scores</div>
              </button>
            </div>
          )}
        </section>

        {/* Heat map */}
        <HeatMap scores={surahScores} />

        <button
          onClick={handleStart}
          disabled={selectedIds.size === 0}
          className="mt-8 w-full rounded-xl bg-emerald-600 py-3 font-semibold text-white transition-all hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Start
        </button>
      </div>
    );
  }

  // ── Testing Screen ───────────────────────────────────────────────────────

  return (
    <div className={`mx-auto max-w-3xl rounded-3xl px-4 py-6 ${pageClass}`}>
      {/* Top bar */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <button
            onClick={handleExitTesting}
            className={`transition-colors ${mutedTextClass} hover:text-inherit`}
            title="Exit test"
            aria-label="Exit test"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
          <span className={`text-sm font-medium ${mutedTextClass}`}>
            {mode === "ayah" ? "Ayah Mode" : "Page Blank"} ·{" "}
            {selectionType === "juz" ? "Juz" : "Surah"} ({selectedIds.size} selected)
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleUndo}
            disabled={history.length === 0}
            className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs transition-all disabled:opacity-30 disabled:cursor-not-allowed ${ghostButtonClass}`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
            </svg>
            Undo
          </button>
        </div>
      </div>

      {/* Card area */}
      {loading && (
        <div className={`flex items-center justify-center rounded-2xl border py-32 ${cardClass}`}>
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
        </div>
      )}

      {error && !loading && (
        <div className="rounded-2xl border border-red-800 bg-red-900/20 p-6 text-center text-red-400">
          {error}
          <button onClick={fetchQuestion} className="mt-3 block mx-auto text-sm underline hover:text-red-300">
            Retry
          </button>
        </div>
      )}

      {!loading && !error && currentQuestion && (
        <>
          {currentQuestion.mode === "ayah" ? (
            <AyahCard
              question={currentQuestion as AyahQuestion}
              revealed={revealed}
              showReference={showReference}
              imageLoaded={imageLoaded}
              onImageLoad={() => setImageLoaded(true)}
              mushafUrl={mushafPageUrl}
            />
          ) : (
            <PageBlankCard
              question={currentQuestion as PageBlankQuestion}
              revealed={revealed}
              imageLoaded={imageLoaded}
              onImageLoad={() => setImageLoaded(true)}
              mushafUrl={mushafPageUrl}
            />
          )}

          {/* Controls */}
          <div className="mt-5 flex flex-col items-center gap-3">
            {!revealed ? (
              <button
                onClick={() => setRevealed(true)}
                className="w-full rounded-xl bg-emerald-600 py-3 font-semibold text-white hover:bg-emerald-500 transition-all"
              >
                Reveal (Space)
              </button>
            ) : (
              <div className="w-full space-y-3">
                {/* <p className={`text-center text-sm ${mutedTextClass}`}>How did you do?</p> */}
                <div className="grid grid-cols-3 gap-2">
                  <button
                    onClick={() => handleRate(0)}
                    className="rounded-xl border border-red-700/50 bg-red-900/20 py-2.5 text-sm font-medium text-red-400 hover:bg-red-900/40 transition-all"
                  >
                    Wrong (1)
                  </button>
                  <button
                    onClick={() => handleRate(1)}
                    className="rounded-xl border border-yellow-600/50 bg-yellow-900/20 py-2.5 text-sm font-medium text-yellow-400 hover:bg-yellow-900/40 transition-all"
                  >
                    Medium (2)
                  </button>
                  <button
                    onClick={() => handleRate(2)}
                    className="rounded-xl border border-emerald-700/50 bg-emerald-900/20 py-2.5 text-sm font-medium text-emerald-400 hover:bg-emerald-900/40 transition-all"
                  >
                    Correct (3)
                  </button>
                </div>
                <button
                  onClick={fetchQuestion}
                  className={`w-full rounded-xl border py-2.5 text-sm transition-all ${ghostButtonClass}`}
                >
                  Skip (Space)
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────

function AyahCard({
  question,
  revealed,
  showReference,
  imageLoaded,
  onImageLoad,
  mushafUrl,
}: {
  question: AyahQuestion;
  revealed: boolean;
  showReference: boolean;
  imageLoaded: boolean;
  onImageLoad: () => void;
  mushafUrl: (page: number) => string;
}) {
  const [surahNum, ayahNum] = question.verseKey.split(":").map(Number);

  return (
    <div className="rounded-2xl border overflow-hidden border-gray-800 bg-gray-900">
      {/* Ayah text — hidden once revealed */}
      {!revealed && (
        <div className="p-6">
          {showReference && (
            <div className="mb-4 flex items-center gap-2">
              <span className="rounded-full bg-emerald-900/40 px-2.5 py-0.5 text-xs font-semibold text-emerald-400">
                {question.surahName} {surahNum}:{ayahNum}
              </span>
              <span className="text-xs text-gray-500">Page {question.pageNumber}</span>
            </div>
          )}
          <p
            dir="rtl"
            lang="ar"
            translate="no"
            className="font-amiri text-right text-3xl leading-loose text-white"
            style={{
              display: "-webkit-box",
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
              // Clamp at rendered line boundaries so no partial last line is shown
              WebkitLineClamp: 4,
            }}
          >
            {question.displayText}
            {question.displayText !== question.fullText && (
              <span className="text-gray-500"> …</span>
            )}
          </p>
        </div>
      )}

      {/* Revealed: mushaf page with ayah highlighted */}
      {revealed && (
        <div>
          <div className="relative bg-black">
            {!imageLoaded && (
              <div className="flex items-center justify-center py-20 text-sm text-gray-600">
                Loading mushaf page…
              </div>
            )}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={mushafUrl(question.pageNumber)}
              alt={`Mushaf page ${question.pageNumber}`}
              className="w-full"
              onLoad={onImageLoad}
              style={{
                display: imageLoaded ? "block" : "none",
                filter: "invert(1) brightness(0.9)",
              }}
            />
            {imageLoaded && (
              <div
                className="absolute left-0 right-0 pointer-events-none"
                style={{
                  top: `${question.positionOnPage * 100}%`,
                  height: "7%",
                  background: "rgba(16, 185, 129, 0.2)",
                  boxShadow: "0 0 0 2px rgba(16, 185, 129, 0.5)",
                }}
              />
            )}
          </div>
          {imageLoaded && (
            <div className="px-4 py-2 text-xs text-center text-gray-500">
              {showReference && (
                <span className="mr-2 text-emerald-400/70">
                  {question.surahName} {surahNum}:{ayahNum} ·{" "}
                </span>
              )}
              Page {question.pageNumber} · Juz {question.juzNumber}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function PageBlankCard({
  question,
  revealed,
  imageLoaded,
  onImageLoad,
  mushafUrl,
}: {
  question: PageBlankQuestion;
  revealed: boolean;
  imageLoaded: boolean;
  onImageLoad: () => void;
  mushafUrl: (page: number) => string;
}) {
  const regionLabel = {
    top: "top third",
    middle: "middle section",
    bottom: "bottom third",
  }[question.coverRegion];

  // Mask out the covered region directly on the image — no overlay div, so no positioning gaps
  const maskGradients: Record<string, string> = {
    top:    "linear-gradient(to bottom, transparent 33%, black 33%)",
    middle: "linear-gradient(to bottom, black 33%, transparent 33%, transparent 67%, black 67%)",
    bottom: "linear-gradient(to bottom, black 67%, transparent 67%)",
  };
  const imageMask = !revealed ? maskGradients[question.coverRegion] : undefined;

  return (
    <div className="rounded-2xl border overflow-hidden border-gray-800 bg-gray-900">
      {!revealed && (
        <div className="px-6 pt-5 pb-2 text-center">
          <p className="text-sm text-gray-400">
            Recall the <span className="font-semibold text-white">{regionLabel}</span> of this page
          </p>
        </div>
      )}
      <div className="relative bg-black">
        {!imageLoaded && (
          <div className="flex items-center justify-center py-20 text-sm text-gray-600">
            Loading mushaf page…
          </div>
        )}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={mushafUrl(question.pageNumber)}
          alt={`Mushaf page ${question.pageNumber}`}
          className="w-full"
          onLoad={onImageLoad}
          style={{
            display: imageLoaded ? "block" : "none",
            filter: "invert(1) brightness(0.9)",
            WebkitMaskImage: imageMask,
            maskImage: imageMask,
            WebkitMaskSize: "100% 100%",
            maskSize: "100% 100%",
          }}
        />
      </div>
      {imageLoaded && (
        <div className="px-4 py-2 text-xs text-center text-gray-500">
          Page {question.pageNumber}
        </div>
      )}
    </div>
  );
}

function ToggleRow({
  label,
  description,
  value,
  onChange,
}: {
  label: string;
  description: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-gray-800 bg-gray-900 px-4 py-3">
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium text-white">{label}</div>
        <div className="text-xs text-gray-500">{description}</div>
      </div>
      <button
        onClick={() => onChange(!value)}
        className={`relative h-5 w-9 flex-shrink-0 rounded-full transition-colors ${
          value ? "bg-emerald-600" : "bg-gray-700"
        }`}
      >
        <span
          className={`absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${
            value ? "translate-x-4" : "translate-x-0"
          }`}
        />
      </button>
    </div>
  );
}

function HeatMap({ scores }: { scores: Record<number, number> }) {
  const hasData = Object.keys(scores).length > 0;

  if (!hasData) return null;

  return (
    <section className="mb-2">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-gray-500">
        Performance Heat Map
      </h2>
      <div className="rounded-lg border border-gray-800 bg-gray-900 p-4">
        <p className="mb-3 text-xs text-gray-500">
          Hover over a cell to see the surah name (each cell is a surah)
        </p>
        <div className="flex gap-2">
          <div className="flex flex-col justify-between pb-0.5 pt-0.5">
            {[1, 20, 39, 58, 77, 96].map((n) => (
              <span key={n} className="text-[10px] leading-none text-gray-600">
                {n}
              </span>
            ))}
          </div>
          <div className="flex-1">
            <div className="grid grid-cols-[repeat(19,minmax(0,1fr))] gap-0.5">
              {CHAPTERS_DATA.map((ch) => {
                const scoreLabel =
                  scores[ch.id] !== undefined
                    ? ["Wrong", "Medium", "Correct"][Math.round(scores[ch.id])]
                    : "Not tested";
                const scoreLabelColor =
                  scores[ch.id] !== undefined
                    ? ["text-red-400", "text-yellow-400", "text-emerald-400"][
                        Math.round(scores[ch.id])
                      ]
                    : "text-gray-500";
                return (
                  <div key={ch.id} className="group relative aspect-square">
                    <div
                      className={`h-full w-full rounded-sm ${scoreToColor(scores[ch.id])}`}
                    />
                    <div className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 -translate-x-1/2 opacity-0 transition-opacity duration-150 group-hover:opacity-100">
                      <div className="whitespace-nowrap rounded-lg border border-gray-700 bg-gray-950 px-2.5 py-1.5 text-center shadow-xl">
                        <div className="text-xs font-semibold text-white">
                          {ch.name_simple}
                        </div>
                        <div className={`text-[10px] ${scoreLabelColor}`}>
                          {scoreLabel}
                        </div>
                      </div>
                      <div className="absolute left-1/2 top-full -translate-x-1/2 border-4 border-transparent border-t-gray-700" />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}


function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;

  const tagName = target.tagName.toLowerCase();
  return (
    target.isContentEditable ||
    tagName === "input" ||
    tagName === "textarea" ||
    tagName === "select"
  );
}
