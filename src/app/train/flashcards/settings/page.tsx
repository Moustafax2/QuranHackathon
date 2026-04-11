"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { UserPreferences, FSRSParameters } from "@/lib/types/flashcard";
import {
  getPreferences,
  savePreferences,
  resetAllData,
  exportData,
  getFSRSParameters,
  saveFSRSParameters,
  getReviewLog,
  getAlgorithmPreference,
  saveAlgorithmPreference,
  clearAllSM2States,
} from "@/lib/storage/flashcard-storage-supabase";
import { DEFAULT_PREFERENCES, DEFAULT_FSRS_PARAMETERS } from "@/lib/types/flashcard";

// ──────────────────────────────────────────────────────────────────
// Info tooltip component
// ──────────────────────────────────────────────────────────────────

function InfoTip({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  return (
    <span className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        className="ml-1.5 inline-flex h-4 w-4 items-center justify-center rounded-full border border-gray-600 text-gray-500 transition-colors hover:border-emerald-500 hover:text-emerald-400"
        aria-label="More info"
      >
        <span className="text-[10px] font-bold leading-none">i</span>
      </button>
      {open && (
        <span className="absolute bottom-full left-1/2 z-50 mb-2 w-64 -translate-x-1/2 rounded-xl border border-gray-700 bg-gray-900 p-3 text-xs leading-relaxed text-gray-300 shadow-xl">
          {text}
          <span className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-700" />
        </span>
      )}
    </span>
  );
}

// ──────────────────────────────────────────────────────────────────
// Algorithm switch modal
// ──────────────────────────────────────────────────────────────────

function AlgorithmSwitchModal({
  targetAlgo,
  onConfirm,
  onCancel,
}: {
  targetAlgo: "fsrs" | "sm2";
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const [step, setStep] = useState<1 | 2>(1);
  const [understood, setUnderstood] = useState(false);

  const toFSRS = targetAlgo === "fsrs";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm px-4">
      <div className="w-full max-w-lg rounded-2xl border border-amber-800/60 bg-gray-900 p-6 shadow-2xl">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-500/20 text-xl">
            ⚠️
          </div>
          <h2 className="text-lg font-bold text-white">
            Switch to {toFSRS ? "FSRS" : "SM-2 (Legacy)"}?
          </h2>
        </div>

        {step === 1 && (
          <>
            <div className="mb-5 space-y-3 rounded-xl border border-amber-800/40 bg-amber-950/30 p-4 text-sm text-amber-200/80">
              <p className="font-semibold text-amber-300">Why you shouldn't switch algorithms often:</p>
              <ul className="ml-4 list-disc space-y-2 text-amber-200/70">
                <li>
                  <strong>Each algorithm tracks memory separately.</strong> FSRS uses stability &amp; difficulty
                  curves; SM-2 uses an easiness factor and fixed repetition counts. Neither can read the
                  other&apos;s data.
                </li>
                <li>
                  <strong>Switching resets your scheduling history</strong> for the new algorithm. All cards
                  restart at day&nbsp;1 for {toFSRS ? "FSRS" : "SM-2"}, even if you&apos;ve already reviewed
                  them hundreds of times.
                </li>
                <li>
                  <strong>Spaced repetition only works long-term.</strong> Frequent algorithm changes fragment
                  your review history and make it impossible for either algorithm to build an accurate model
                  of your memory.
                </li>
                <li>
                  {toFSRS
                    ? "FSRS is significantly more accurate than SM-2 at predicting forgetting. We recommend staying on FSRS unless you have a specific reason to switch."
                    : "SM-2 is a simpler, older algorithm (1987). It works, but FSRS is more accurate, especially after you accumulate review history."}
                </li>
              </ul>
            </div>
            <div className="flex gap-3">
              <button
                onClick={onCancel}
                className="flex-1 rounded-xl border border-gray-700 bg-gray-800 px-4 py-2.5 text-sm font-medium text-gray-300 hover:bg-gray-700"
              >
                Cancel
              </button>
              <button
                onClick={() => setStep(2)}
                className="flex-1 rounded-xl border border-amber-700 bg-amber-900/40 px-4 py-2.5 text-sm font-medium text-amber-300 hover:bg-amber-900/60"
              >
                I understand, continue
              </button>
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <p className="mb-4 text-sm text-gray-400">
              Your existing {toFSRS ? "SM-2" : "FSRS"} review progress will be kept in case you switch back,
              but <strong className="text-white">all cards will restart from scratch</strong> under{" "}
              {toFSRS ? "FSRS" : "SM-2"}.
            </p>
            <label className="mb-5 flex cursor-pointer items-start gap-3 rounded-xl border border-gray-700 bg-gray-800 p-4">
              <input
                type="checkbox"
                checked={understood}
                onChange={(e) => setUnderstood(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-gray-600 bg-gray-700 text-amber-500 focus:ring-amber-500"
              />
              <span className="text-sm text-gray-300">
                I understand that switching resets my scheduling progress for{" "}
                {toFSRS ? "FSRS" : "SM-2"} and I should not switch frequently.
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
                disabled={!understood}
                onClick={onConfirm}
                className="flex-1 rounded-xl bg-amber-600 px-4 py-2.5 text-sm font-semibold text-white transition-all hover:bg-amber-500 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Switch to {toFSRS ? "FSRS" : "SM-2"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────
// Optimize warning modal
// ──────────────────────────────────────────────────────────────────

function OptimizeWarningModal({
  reviewCount,
  onConfirm,
  onCancel,
}: {
  reviewCount: number;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm px-4">
      <div className="w-full max-w-md rounded-2xl border border-gray-700 bg-gray-900 p-6 shadow-2xl">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-xl">
            🧠
          </div>
          <h2 className="text-lg font-bold text-white">Before You Optimize</h2>
        </div>
        <div className="mb-5 space-y-3 text-sm text-gray-400">
          <p>
            You have <strong className="text-emerald-400">{reviewCount} reviews</strong> recorded.
            Optimization fits the 21 FSRS weight parameters to your personal review history.
          </p>
          <div className="rounded-xl border border-gray-700 bg-gray-800 p-4 space-y-2">
            <p className="font-semibold text-gray-300">Why you shouldn't optimize too often:</p>
            <ul className="ml-4 list-disc space-y-1.5 text-gray-400">
              <li>Optimizing on too little data causes <strong className="text-gray-300">overfitting</strong> — the weights fit noise, not your actual memory patterns.</li>
              <li>The algorithm needs to observe a full forgetting curve for each card, which takes <strong className="text-gray-300">weeks to months</strong> of consistent reviews.</li>
              <li>Re-optimizing every few days adds no benefit and can actually make scheduling <strong className="text-gray-300">less accurate</strong>.</li>
              <li>A good rule of thumb: optimize at most <strong className="text-gray-300">once per month</strong>, and only after you have at least a few hundred reviews.</li>
            </ul>
          </div>
          <p className="text-gray-500 text-xs">
            Recommended: ≥ 1,000 reviews, optimized no more than once per month.
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 rounded-xl border border-gray-700 bg-gray-800 px-4 py-2.5 text-sm font-medium text-gray-300 hover:bg-gray-700"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-500"
          >
            Optimize anyway
          </button>
        </div>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────
// Reset warning modal
// ──────────────────────────────────────────────────────────────────

function ResetWarningModal({
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
          <h2 className="text-lg font-bold text-white">Reset All Flashcard Data?</h2>
        </div>

        <div className="mb-5 space-y-3 rounded-xl border border-red-900/40 bg-red-950/30 p-4 text-sm text-red-200/80">
          <p className="font-semibold text-red-300">This will permanently delete:</p>
          <ul className="ml-4 list-disc space-y-1.5 text-red-200/70">
            <li>All your <strong>review history</strong> and scheduling data</li>
            <li>All <strong>FSRS and SM-2 card states</strong> (intervals, stability, difficulty)</li>
            <li>All <strong>learned and due cards</strong> — everything restarts from zero</li>
          </ul>
          <p className="mt-2 text-red-300/90 font-medium">This cannot be undone.</p>
        </div>

        <label className="mb-5 flex cursor-pointer items-start gap-3 rounded-xl border border-gray-700 bg-gray-800 p-4">
          <input
            type="checkbox"
            checked={confirmed}
            onChange={(e) => setConfirmed(e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-gray-600 bg-gray-700 text-red-500 focus:ring-red-500"
          />
          <span className="text-sm text-gray-300">
            I understand this will permanently delete all my flashcard progress and cannot be undone.
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
            Reset everything
          </button>
        </div>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────
// Main settings page
// ──────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const router = useRouter();
  const [prefs, setPrefs] = useState<UserPreferences>(DEFAULT_PREFERENCES);
  const [fsrsParams, setFsrsParams] = useState<FSRSParameters>(DEFAULT_FSRS_PARAMETERS);
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [reviewCount, setReviewCount] = useState(0);

  // Algorithm switch flow
  const [algoSwitchTarget, setAlgoSwitchTarget] = useState<"fsrs" | "sm2" | null>(null);
  const [showAlgoSection, setShowAlgoSection] = useState(false);

  // Optimize warning
  const [showOptimizeWarning, setShowOptimizeWarning] = useState(false);

  // Reset warning
  const [showResetWarning, setShowResetWarning] = useState(false);

  useEffect(() => {
    async function loadPrefs() {
      const [preferences, logs] = await Promise.all([
        getPreferences(),
        getReviewLog(),
      ]);
      // Merge algorithm from localStorage (not stored in Supabase)
      const algo = getAlgorithmPreference();
      setPrefs({ ...preferences, algorithm: algo });
      setFsrsParams(getFSRSParameters());
      setReviewCount(logs.length);
      setLoading(false);
    }
    loadPrefs();
  }, []);

  const handleSave = async () => {
    await savePreferences(prefs);
    saveFSRSParameters(fsrsParams);
    saveAlgorithmPreference(prefs.algorithm);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleReset = async () => {
    await resetAllData();
    clearAllSM2States();
    router.push("/train/flashcards");
  };

  const handleExport = async () => {
    const data = await exportData();
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `qalamspace-backup-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleResetFSRS = () => setFsrsParams(DEFAULT_FSRS_PARAMETERS);

  const handleAlgoSwitch = (target: "fsrs" | "sm2") => {
    if (target === prefs.algorithm) return;
    setAlgoSwitchTarget(target);
  };

  const confirmAlgoSwitch = () => {
    if (!algoSwitchTarget) return;
    setPrefs((p) => ({ ...p, algorithm: algoSwitchTarget }));
    saveAlgorithmPreference(algoSwitchTarget);
    setAlgoSwitchTarget(null);
  };

  const updatePref = <K extends keyof UserPreferences>(key: K, value: UserPreferences[K]) => {
    setPrefs((prev) => ({ ...prev, [key]: value }));
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-950">
        <div className="text-center">
          <div className="mb-4 h-12 w-12 animate-spin rounded-full border-4 border-emerald-500 border-t-transparent" />
          <p className="text-gray-400">Loading settings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 px-4 py-12">
      {/* Algorithm switch modal */}
      {algoSwitchTarget && (
        <AlgorithmSwitchModal
          targetAlgo={algoSwitchTarget}
          onConfirm={confirmAlgoSwitch}
          onCancel={() => setAlgoSwitchTarget(null)}
        />
      )}

      {/* Reset warning modal */}
      {showResetWarning && (
        <ResetWarningModal
          onConfirm={() => {
            setShowResetWarning(false);
            handleReset();
          }}
          onCancel={() => setShowResetWarning(false)}
        />
      )}

      {/* Optimize warning modal */}
      {showOptimizeWarning && (
        <OptimizeWarningModal
          reviewCount={reviewCount}
          onConfirm={() => {
            setShowOptimizeWarning(false);
            // Optimization is not yet implemented server-side.
            // Placeholder: alert user.
            alert("Optimization will be available in a future update. Keep reviewing to build up your history!");
          }}
          onCancel={() => setShowOptimizeWarning(false)}
        />
      )}

      <div className="mx-auto max-w-4xl">
        <div className="mb-8">
          <h1 className="mb-2 text-3xl font-bold text-white">Settings</h1>
          <p className="text-gray-400">Customize your learning experience</p>
        </div>

        <div className="space-y-6">
          {/* ── Card Display ───────────────────────────────────────── */}
          <div className="rounded-2xl border border-gray-800 bg-gray-900 p-6">
            <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-white">
              <span>🎴</span> Card Display
            </h2>
            <div className="space-y-4">
              {(
                [
                  ["show_arabic_explanation", "Show Arabic explanation"],
                  ["show_root",               "Show root/lemma"],
                  ["show_ayah_examples",      "Show ayah examples"],
                ] as const
              ).map(([key, label]) => (
                <label key={key} className="flex items-center justify-between">
                  <span className="text-gray-300">{label}</span>
                  <input
                    type="checkbox"
                    checked={prefs[key] as boolean}
                    onChange={(e) => updatePref(key, e.target.checked)}
                    className="h-5 w-5 rounded border-gray-700 bg-gray-800 text-emerald-600 focus:ring-2 focus:ring-emerald-500"
                  />
                </label>
              ))}
            </div>
          </div>

          {/* ── Word Filtering ─────────────────────────────────────── */}
          <div className="rounded-2xl border border-gray-800 bg-gray-900 p-6">
            <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-white">
              <span>🔍</span> Word Filtering
            </h2>
            <div className="space-y-4">
              <label className="flex items-center justify-between">
                <span className="text-gray-300">Include particles</span>
                <input type="checkbox" checked={prefs.include_particles}
                  onChange={(e) => updatePref("include_particles", e.target.checked)}
                  className="h-5 w-5 rounded border-gray-700 bg-gray-800 text-emerald-600 focus:ring-2 focus:ring-emerald-500" />
              </label>
              <label className="flex items-center justify-between">
                <span className="text-gray-300">Include proper nouns</span>
                <input type="checkbox" checked={prefs.include_proper_nouns}
                  onChange={(e) => updatePref("include_proper_nouns", e.target.checked)}
                  className="h-5 w-5 rounded border-gray-700 bg-gray-800 text-emerald-600 focus:ring-2 focus:ring-emerald-500" />
              </label>
            </div>
          </div>

          {/* ── Learning Limits ────────────────────────────────────── */}
          <div className="rounded-2xl border border-gray-800 bg-gray-900 p-6">
            <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-white">
              <span>📊</span> Learning Limits
            </h2>
            <div className="space-y-6">
              {(
                [
                  ["daily_new_cards_limit",    "Daily new cards",    0,   50],
                  ["daily_review_cards_limit", "Daily review cards", 0,  200],
                  ["session_size",             "Session size",       5,   50],
                ] as const
              ).map(([key, label, min, max]) => (
                <div key={key}>
                  <label className="mb-2 flex items-center justify-between text-gray-300">
                    <span>{label}</span>
                    <span className="text-emerald-400">{prefs[key]}</span>
                  </label>
                  <input type="range" min={min} max={max}
                    value={prefs[key] as number}
                    onChange={(e) => updatePref(key, parseInt(e.target.value))}
                    className="w-full" />
                </div>
              ))}
            </div>
          </div>

          {/* ── Advanced (collapsible) ─────────────────────────────── */}
          <div className="rounded-2xl border border-gray-800 bg-gray-900 p-6">
            <button
              onClick={() => setAdvancedOpen((v) => !v)}
              className="flex w-full items-center justify-between text-left"
            >
              <h2 className="flex items-center gap-2 text-lg font-semibold text-white">
                <span>⚙️</span> Advanced
              </h2>
              <span
                className="text-gray-400 transition-transform duration-200"
                style={{ display: "inline-block", transform: advancedOpen ? "rotate(180deg)" : "rotate(0deg)" }}
              >
                ▾
              </span>
            </button>

            {advancedOpen && (
              <div className="mt-6 space-y-6">

                {/* ── FSRS Algorithm Parameters ─────────────────── */}
                <div className="rounded-xl border border-gray-700 bg-gray-800/50 p-5">
                  <div className="mb-5 flex items-center justify-between">
                    <div>
                      <div className="flex items-center font-medium text-white">
                        FSRS Algorithm
                        <InfoTip text="FSRS (Free Spaced Repetition Scheduler) is a modern memory algorithm that models your forgetting curve. It adapts to your personal memory patterns to show you cards at the optimal moment — right before you'd forget them." />
                      </div>
                      <div className="mt-0.5 text-xs text-gray-500">Spaced repetition parameters</div>
                    </div>
                    <button
                      onClick={handleResetFSRS}
                      className="rounded-lg border border-gray-600 px-3 py-1 text-xs text-gray-400 hover:border-gray-500 hover:text-gray-300"
                    >
                      Reset defaults
                    </button>
                  </div>

                  <div className="space-y-6">
                    {/* Desired Retention */}
                    <div>
                      <label className="mb-2 flex items-center justify-between text-sm text-gray-300">
                        <span className="flex items-center">
                          Desired Retention
                          <InfoTip text="The probability that you remember a card when it comes up for review. Higher retention = more reviews (harder to forget), lower retention = fewer reviews but you'll forget more. 90% is a good default for language learning." />
                        </span>
                        <span className="font-mono text-emerald-400">
                          {Math.round(fsrsParams.request_retention * 100)}%
                        </span>
                      </label>
                      <input type="range" min="70" max="99" step="1"
                        value={Math.round(fsrsParams.request_retention * 100)}
                        onChange={(e) =>
                          setFsrsParams((p) => ({ ...p, request_retention: parseInt(e.target.value) / 100 }))
                        }
                        className="w-full" />
                      <div className="mt-1 flex justify-between text-xs text-gray-600">
                        <span>70% (fewer reviews)</span>
                        <span>99% (more reviews)</span>
                      </div>
                    </div>

                    {/* Maximum Interval */}
                    <div>
                      <label className="mb-2 flex items-center justify-between text-sm text-gray-300">
                        <span className="flex items-center">
                          Maximum Interval
                          <InfoTip text="The longest gap FSRS will schedule between reviews. Even if the algorithm predicts you could wait 2 years, this caps it. Lower values give you more frequent refreshes; higher values let FSRS stretch mature cards further." />
                        </span>
                        <span className="font-mono text-emerald-400">{fsrsParams.maximum_interval}d</span>
                      </label>
                      <input type="range" min="7" max="365" step="1"
                        value={fsrsParams.maximum_interval}
                        onChange={(e) =>
                          setFsrsParams((p) => ({ ...p, maximum_interval: parseInt(e.target.value) }))
                        }
                        className="w-full" />
                      <div className="mt-1 flex justify-between text-xs text-gray-600">
                        <span>7 days</span>
                        <span>365 days</span>
                      </div>
                    </div>

                    {/* Enable Fuzz */}
                    <label className="flex items-center justify-between text-sm">
                      <span className="flex items-center text-gray-300">
                        Interval fuzz
                        <InfoTip text="Adds a small random offset (±5–15%) to review intervals. This prevents all your cards from bunching up on the same day and keeps your daily review load more even." />
                      </span>
                      <input type="checkbox"
                        checked={fsrsParams.enable_fuzz}
                        onChange={(e) =>
                          setFsrsParams((p) => ({ ...p, enable_fuzz: e.target.checked }))
                        }
                        className="h-5 w-5 rounded border-gray-700 bg-gray-800 text-emerald-600 focus:ring-2 focus:ring-emerald-500" />
                    </label>

                    {/* Model Weights */}
                    <div>
                      <div className="mb-3 flex items-center justify-between">
                        <div>
                          <div className="flex items-center text-sm text-gray-300">
                            Model weights (w)
                            <InfoTip text="The 21 parameters that define your personal forgetting curve. The defaults work well for most people. After accumulating enough review history, the Optimize button fits these to YOUR memory patterns, improving scheduling accuracy." />
                          </div>
                          <div className="mt-0.5 text-xs text-gray-500">
                            {reviewCount} reviews recorded
                          </div>
                        </div>
                        <button
                          onClick={() => setShowOptimizeWarning(true)}
                          disabled={reviewCount < 100}
                          title={
                            reviewCount < 100
                              ? `Need ${100 - reviewCount} more reviews before optimizing`
                              : "Optimize weights based on your review history"
                          }
                          className="rounded-lg border border-emerald-700 px-3 py-1.5 text-xs font-medium text-emerald-400 transition-all hover:border-emerald-500 hover:bg-emerald-500/10 disabled:cursor-not-allowed disabled:border-gray-700 disabled:text-gray-600"
                        >
                          {reviewCount < 100
                            ? `Optimize (${reviewCount}/100)`
                            : "Optimize"}
                        </button>
                      </div>
                      <div className="grid grid-cols-7 gap-1">
                        {fsrsParams.w.map((val, i) => (
                          <div key={i} className="rounded bg-gray-900 px-1 py-1.5 text-center">
                            <div className="text-[10px] text-gray-600">w{i}</div>
                            <div className="font-mono text-[10px] text-gray-400">{val.toFixed(3)}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* ── Algorithm Selector ────────────────────────── */}
                <div className="rounded-xl border border-gray-700 bg-gray-800/50 p-5">
                  <div className="mb-3 flex items-center">
                    <span className="font-medium text-white">Scheduling Algorithm</span>
                    <InfoTip text="FSRS (recommended) is a modern algorithm that accurately models human memory using a forgetting curve. SM-2 is the classic 1987 algorithm used by Anki; it's simpler but less accurate. Only switch if you have a specific reason — switching resets your scheduling history for the new algorithm." />
                  </div>

                  {!showAlgoSection ? (
                    <button
                      onClick={() => setShowAlgoSection(true)}
                      className="w-full rounded-xl border border-dashed border-gray-600 px-4 py-3 text-sm text-gray-500 transition-colors hover:border-gray-500 hover:text-gray-400"
                    >
                      Current algorithm: <strong className="text-gray-300">{prefs.algorithm === "fsrs" ? "FSRS" : "SM-2 (Legacy)"}</strong> — Click to change
                    </button>
                  ) : (
                    <div className="space-y-3">
                      <p className="text-xs text-amber-400/80">
                        ⚠️ Switching algorithms resets scheduling data. Read the warning carefully before confirming.
                      </p>
                      <div className="grid grid-cols-2 gap-3">
                        <button
                          onClick={() => handleAlgoSwitch("fsrs")}
                          className={`rounded-xl border p-4 text-left transition-all ${
                            prefs.algorithm === "fsrs"
                              ? "border-emerald-500 bg-emerald-500/10"
                              : "border-gray-700 bg-gray-900 hover:border-gray-600"
                          }`}
                        >
                          <div className="mb-1 font-semibold text-white">
                            FSRS
                            {prefs.algorithm === "fsrs" && (
                              <span className="ml-2 text-xs text-emerald-400">✓ Active</span>
                            )}
                          </div>
                          <div className="text-xs text-gray-400">
                            Modern algorithm. Accurate forgetting curves. Recommended.
                          </div>
                        </button>
                        <button
                          onClick={() => handleAlgoSwitch("sm2")}
                          className={`rounded-xl border p-4 text-left transition-all ${
                            prefs.algorithm === "sm2"
                              ? "border-amber-500 bg-amber-500/10"
                              : "border-gray-700 bg-gray-900 hover:border-gray-600"
                          }`}
                        >
                          <div className="mb-1 font-semibold text-white">
                            SM-2 <span className="text-xs font-normal text-gray-500">(Legacy)</span>
                            {prefs.algorithm === "sm2" && (
                              <span className="ml-2 text-xs text-amber-400">✓ Active</span>
                            )}
                          </div>
                          <div className="text-xs text-gray-400">
                            Classic 1987 algorithm. Simpler, but less accurate than FSRS.
                          </div>
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* ── Data Management ───────────────────────────── */}
                <div className="space-y-3">
                  <button
                    onClick={handleExport}
                    className="w-full rounded-xl border border-gray-700 bg-gray-800 px-4 py-3 text-left text-gray-300 transition-all hover:border-emerald-500 hover:bg-gray-700"
                  >
                    <div className="font-medium">Export Data</div>
                    <div className="text-sm text-gray-500">Download your flashcards and progress</div>
                  </button>
                  <button
                    onClick={handleReset}
                    className="w-full rounded-xl border border-red-900 bg-red-950 px-4 py-3 text-left text-red-400 transition-all hover:border-red-700 hover:bg-red-900"
                  >
                    <div className="font-medium">Reset All Data</div>
                    <div className="text-sm text-red-500">Delete all flashcards and progress</div>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* ── Save / Cancel ──────────────────────────────────────── */}
          <div className="flex gap-4">
            <button
              onClick={() => router.push("/train/flashcards")}
              className="flex-1 rounded-xl border border-gray-700 bg-gray-800 px-6 py-3 font-semibold text-gray-300 transition-all hover:bg-gray-700"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="flex-1 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-700 px-6 py-3 font-semibold text-white shadow-lg transition-all hover:scale-105 hover:shadow-xl"
            >
              {saved ? "✓ Saved!" : "Save Settings"}
            </button>
          </div>

          {/* ── Danger Zone ────────────────────────────────────────── */}
          <div className="rounded-2xl border border-red-900/40 bg-red-950/10 p-6">
            <h2 className="mb-1 flex items-center gap-2 text-lg font-semibold text-red-400">
              <span>⚠️</span> Danger Zone
            </h2>
            <p className="mb-4 text-sm text-gray-500">
              These actions are permanent and cannot be undone.
            </p>
            <button
              onClick={() => setShowResetWarning(true)}
              className="w-full rounded-xl border border-red-900 bg-red-950/40 px-4 py-3 text-left text-red-400 transition-all hover:border-red-700 hover:bg-red-950/70"
            >
              <div className="font-medium">Reset Flashcard Suite</div>
              <div className="text-sm text-red-500/70">Delete all review history, card states, and progress</div>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
