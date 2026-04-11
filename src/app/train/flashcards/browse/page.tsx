"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { getFlashcards, deleteFlashcard, updateFlashcard } from "@/lib/storage/flashcard-storage-supabase";
import { loadLexicalDB, getWordById } from "@/lib/corpus/lexical-db";
import { FSRSState } from "@/lib/types/flashcard";
import type { UserFlashcard, LexicalEntry } from "@/lib/types/flashcard";
import { FlashcardReview } from "@/components/flashcard/FlashcardReview";

type SortKey = "due" | "stability" | "lapses" | "state";
type SortDir = "asc" | "desc";
type StateFilter = "all" | FSRSState;

const STATE_LABELS: Record<FSRSState, string> = {
  [FSRSState.New]: "New",
  [FSRSState.Learning]: "Learning",
  [FSRSState.Review]: "Review",
  [FSRSState.Relearning]: "Relearning",
};

const STATE_COLORS: Record<FSRSState, string> = {
  [FSRSState.New]: "bg-blue-500/20 text-blue-400",
  [FSRSState.Learning]: "bg-emerald-500/20 text-emerald-400",
  [FSRSState.Review]: "bg-purple-500/20 text-purple-400",
  [FSRSState.Relearning]: "bg-orange-500/20 text-orange-400",
};

interface CardRow {
  card: UserFlashcard;
  word: LexicalEntry | null;
}

export default function BrowsePage() {
  const [rows, setRows] = useState<CardRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortKey, setSortKey] = useState<SortKey>("due");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [stateFilter, setStateFilter] = useState<StateFilter>("all");
  const [search, setSearch] = useState("");
  const [pendingAction, setPendingAction] = useState<{ id: string; type: "delete" | "unlearn" } | null>(null);
  const [previewRow, setPreviewRow] = useState<CardRow | null>(null);
  const [stabilityTooltip, setStabilityTooltip] = useState(false);

  useEffect(() => {
    async function load() {
      const [cards, db] = await Promise.all([getFlashcards(), loadLexicalDB()]);
      const wordMap = new Map(db.map((e) => [e.id, e]));
      const rows = await Promise.all(
        cards.map(async (card) => ({
          card,
          word: wordMap.get(card.word_id) ?? (await getWordById(card.word_id)),
        }))
      );
      setRows(rows);
      setLoading(false);
    }
    load();
  }, []);

  const handleDelete = async (cardId: string) => {
    await deleteFlashcard(cardId);
    setRows((prev) => prev.filter((r) => r.card.id !== cardId));
    setPendingAction(null);
  };

  const handleUnlearn = async (cardId: string) => {
    const resetState = {
      due: new Date(),
      stability: 0,
      difficulty: 0,
      elapsed_days: 0,
      scheduled_days: 0,
      learning_steps: 0,
      reps: 0,
      lapses: 0,
      state: FSRSState.New,
      last_review: undefined,
    };
    await updateFlashcard(cardId, { fsrs_state: resetState });
    setRows((prev) =>
      prev.map((r) =>
        r.card.id === cardId ? { ...r, card: { ...r.card, fsrs_state: resetState } } : r
      )
    );
    setPendingAction(null);
  };

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const filtered = useMemo(() => {
    let result = rows;

    if (stateFilter !== "all") {
      result = result.filter((r) => r.card.fsrs_state.state === stateFilter);
    }

    if (search.trim()) {
      const q = search.trim().toLowerCase();
      result = result.filter(
        (r) =>
          r.word?.canonical_form.includes(q) ||
          r.word?.translation.toLowerCase().includes(q) ||
          r.word?.root?.includes(q)
      );
    }

    return [...result].sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case "due":
          cmp = new Date(a.card.fsrs_state.due).getTime() - new Date(b.card.fsrs_state.due).getTime();
          break;
        case "stability":
          cmp = a.card.fsrs_state.stability - b.card.fsrs_state.stability;
          break;
        case "lapses":
          cmp = a.card.fsrs_state.lapses - b.card.fsrs_state.lapses;
          break;
        case "state":
          cmp = a.card.fsrs_state.state - b.card.fsrs_state.state;
          break;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [rows, stateFilter, search, sortKey, sortDir]);

  const SortIcon = ({ k }: { k: SortKey }) =>
    sortKey !== k ? (
      <span className="text-gray-700">↕</span>
    ) : sortDir === "asc" ? (
      <span className="text-emerald-400">↑</span>
    ) : (
      <span className="text-emerald-400">↓</span>
    );

  const formatDue = (due: Date) => {
    const d = new Date(due);
    const now = new Date();
    const diff = d.getTime() - now.getTime();
    const days = Math.round(diff / 86400000);
    if (days < 0) return <span className="text-red-400">Overdue {Math.abs(days)}d</span>;
    if (days === 0) return <span className="text-emerald-400">Today</span>;
    if (days === 1) return <span className="text-yellow-400">Tomorrow</span>;
    return <span className="text-gray-400">in {days}d</span>;
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-950">
        <div className="text-center">
          <div className="mb-4 h-12 w-12 animate-spin rounded-full border-4 border-emerald-500 border-t-transparent" />
          <p className="text-gray-400">Loading deck...</p>
        </div>
      </div>
    );
  }

  const stateCounts = Object.values(FSRSState).filter((v) => typeof v === "number") as FSRSState[];

  return (
    <div className="min-h-screen bg-gray-950 px-4 py-12" onClick={() => setStabilityTooltip(false)}>
      <div className="mx-auto max-w-6xl">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="mb-1 text-3xl font-bold text-white">Deck Browser</h1>
            <p className="text-gray-400">{rows.length} cards total</p>
          </div>
          <Link
            href="/train/flashcards"
            className="rounded-xl border border-gray-700 bg-gray-900 px-4 py-2 text-sm text-gray-400 transition-all hover:border-gray-600 hover:text-white"
          >
            ← Back
          </Link>
        </div>

        {/* Filters */}
        <div className="mb-6 flex flex-wrap items-center gap-3">
          <input
            type="text"
            placeholder="Search Arabic, translation, root…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="rounded-xl border border-gray-700 bg-gray-900 px-4 py-2 text-sm text-white placeholder-gray-600 outline-none focus:border-emerald-500/50 sm:w-64"
          />

          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setStateFilter("all")}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                stateFilter === "all" ? "bg-gray-700 text-white" : "bg-gray-900 text-gray-500 hover:bg-gray-800"
              }`}
            >
              All ({rows.length})
            </button>
            {stateCounts.map((state) => {
              const count = rows.filter((r) => r.card.fsrs_state.state === state).length;
              return (
                <button
                  key={state}
                  onClick={() => setStateFilter(state)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                    stateFilter === state
                      ? STATE_COLORS[state] + " border border-current/30"
                      : "bg-gray-900 text-gray-500 hover:bg-gray-800"
                  }`}
                >
                  {STATE_LABELS[state]} ({count})
                </button>
              );
            })}
          </div>
        </div>

        {/* Table */}
        <div className="overflow-hidden rounded-2xl border border-gray-800">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-gray-800 bg-gray-900/80">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-gray-400">Word</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-400">Translation</th>
                  <th
                    className="cursor-pointer px-4 py-3 text-left font-medium text-gray-400 hover:text-white"
                    onClick={() => handleSort("state")}
                  >
                    <span className="flex items-center gap-1">State <SortIcon k="state" /></span>
                  </th>
                  <th
                    className="cursor-pointer px-4 py-3 text-left font-medium text-gray-400 hover:text-white"
                    onClick={() => handleSort("due")}
                  >
                    <span className="flex items-center gap-1">Due <SortIcon k="due" /></span>
                  </th>
                  <th
                    className="cursor-pointer px-4 py-3 text-left font-medium text-gray-400 hover:text-white"
                    onClick={() => handleSort("stability")}
                  >
                    <span className="flex items-center gap-1">
                      Stability
                      <span
                        className="relative"
                        onClick={(e) => { e.stopPropagation(); setStabilityTooltip((v) => !v); }}
                      >
                        <span className="ml-0.5 inline-flex h-4 w-4 cursor-pointer items-center justify-center rounded-full border border-gray-600 text-[10px] text-gray-500 hover:border-gray-400 hover:text-gray-300">
                          i
                        </span>
                        {stabilityTooltip && (
                          <div className="absolute left-1/2 top-6 z-20 w-64 -translate-x-1/2 rounded-xl border border-gray-700 bg-gray-900 px-3 py-2.5 text-xs text-gray-300 shadow-xl">
                            <p className="mb-1 font-semibold text-white">Memory Stability</p>
                            <p>Estimated number of days until you&apos;d have a 90% chance of recalling this card. Higher = stronger memory.</p>
                          </div>
                        )}
                      </span>
                      <SortIcon k="stability" />
                    </span>
                  </th>
                  <th
                    className="cursor-pointer px-4 py-3 text-left font-medium text-gray-400 hover:text-white"
                    onClick={() => handleSort("lapses")}
                  >
                    <span className="flex items-center gap-1">Lapses <SortIcon k="lapses" /></span>
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-gray-400">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/60">
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-10 text-center text-gray-600">
                      No cards match your filters
                    </td>
                  </tr>
                )}
                {filtered.map(({ card, word }) => (
                  <tr
                    key={card.id}
                    className="cursor-pointer bg-gray-950 transition-colors hover:bg-gray-900/60"
                    onClick={() => word && setPreviewRow({ card, word })}
                  >
                    <td className="px-4 py-3">
                      <span className="font-amiri text-xl text-white">
                        {word?.canonical_form.replace(/\s*[\[(][^\])\n]*[\])].*$/, "").trim() ?? card.word_id}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-300">{word?.translation ?? "—"}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STATE_COLORS[card.fsrs_state.state]}`}>
                        {STATE_LABELS[card.fsrs_state.state]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs">{formatDue(card.fsrs_state.due)}</td>
                    <td className="px-4 py-3 text-gray-400">
                      {card.fsrs_state.stability > 0
                        ? `${card.fsrs_state.stability.toFixed(1)}d`
                        : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <span className={card.fsrs_state.lapses > 0 ? "text-red-400" : "text-gray-600"}>
                        {card.fsrs_state.lapses}
                      </span>
                    </td>
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      {pendingAction?.id === card.id ? (
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-400">
                            {pendingAction.type === "delete" ? "Delete card?" : "Reset progress?"}
                          </span>
                          <button
                            onClick={() =>
                              pendingAction.type === "delete"
                                ? handleDelete(card.id)
                                : handleUnlearn(card.id)
                            }
                            className="rounded px-2 py-0.5 text-xs font-medium bg-red-500/20 text-red-400 hover:bg-red-500/40 transition-colors"
                          >
                            Confirm
                          </button>
                          <button
                            onClick={() => setPendingAction(null)}
                            className="rounded px-2 py-0.5 text-xs font-medium bg-gray-800 text-gray-400 hover:bg-gray-700 transition-colors"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setPendingAction({ id: card.id, type: "unlearn" })}
                            className="rounded px-2 py-0.5 text-xs font-medium bg-yellow-500/10 text-yellow-500 hover:bg-yellow-500/25 transition-colors"
                            title="Reset progress to New"
                          >
                            Unlearn
                          </button>
                          <button
                            onClick={() => setPendingAction({ id: card.id, type: "delete" })}
                            className="rounded px-2 py-0.5 text-xs font-medium bg-red-500/10 text-red-500 hover:bg-red-500/25 transition-colors"
                            title="Remove card permanently"
                          >
                            Delete
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {filtered.length > 0 && (
          <p className="mt-3 text-right text-xs text-gray-700">
            Showing {filtered.length} of {rows.length} cards
          </p>
        )}
      </div>

      {/* Card preview modal */}
      {previewRow && previewRow.word && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm"
          onClick={() => setPreviewRow(null)}
        >
          <div
            className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setPreviewRow(null)}
              className="absolute -top-3 -right-3 z-10 flex h-8 w-8 items-center justify-center rounded-full border border-gray-700 bg-gray-900 text-gray-400 hover:text-white transition-colors"
            >
              ✕
            </button>
            <FlashcardReview
              word={previewRow.word}
              onReview={() => {}}
              showRoot
              showExamples
              initialFlipped
              previewMode
            />
          </div>
        </div>
      )}
    </div>
  );
}
