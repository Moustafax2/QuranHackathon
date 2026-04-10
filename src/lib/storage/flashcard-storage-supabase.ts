"use client";

// ── localStorage-only helpers (algorithm/SM2/FSRS params) ─────────────────────
// These are device-local preferences that don't need to be in the DB.

import type {
  UserFlashcard,
  ReviewLogEntry,
  ReviewLogFilters,
  UserPreferences,
  FSRSCard,
  WordStatus,
  Rating,
  FSRSState,
  FSRSParameters,
  SM2Card,
} from "@/lib/types/flashcard";
import { DEFAULT_PREFERENCES, DEFAULT_FSRS_PARAMETERS } from "@/lib/types/flashcard";
import * as localFlashcardStorage from "@/lib/storage/flashcard-storage";

const FSRS_PARAMS_KEY = "qalamspace_fsrs_params";
const SM2_STATES_KEY = "qalamspace_sm2_states";
const ALGORITHM_KEY = "qalamspace_algorithm";

export function getFSRSParameters(): FSRSParameters {
  if (typeof window === "undefined") return DEFAULT_FSRS_PARAMETERS;
  try {
    const json = localStorage.getItem(FSRS_PARAMS_KEY);
    if (!json) return DEFAULT_FSRS_PARAMETERS;
    return { ...DEFAULT_FSRS_PARAMETERS, ...JSON.parse(json) };
  } catch {
    return DEFAULT_FSRS_PARAMETERS;
  }
}

export function saveFSRSParameters(params: FSRSParameters): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(FSRS_PARAMS_KEY, JSON.stringify(params));
}

export function getAlgorithmPreference(): "fsrs" | "sm2" {
  if (typeof window === "undefined") return "fsrs";
  return (localStorage.getItem(ALGORITHM_KEY) as "fsrs" | "sm2") ?? "fsrs";
}

export function saveAlgorithmPreference(algo: "fsrs" | "sm2"): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(ALGORITHM_KEY, algo);
}

export function getAllSM2States(): Record<string, SM2Card> {
  if (typeof window === "undefined") return {};
  try {
    const json = localStorage.getItem(SM2_STATES_KEY);
    if (!json) return {};
    const raw = JSON.parse(json) as Record<string, SM2Card & { due: string; last_review?: string }>;
    const result: Record<string, SM2Card> = {};
    for (const [id, state] of Object.entries(raw)) {
      result[id] = {
        ...state,
        due: new Date(state.due),
        last_review: state.last_review ? new Date(state.last_review) : undefined,
      };
    }
    return result;
  } catch {
    return {};
  }
}

export function saveSM2State(cardId: string, state: SM2Card): void {
  if (typeof window === "undefined") return;
  const all = getAllSM2States();
  all[cardId] = state;
  localStorage.setItem(SM2_STATES_KEY, JSON.stringify(all));
}

export function clearAllSM2States(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(SM2_STATES_KEY);
}

// ── API helpers ───────────────────────────────────────────────────────────────
// All flashcard data goes through server-side API routes authenticated via the
// QF session cookie. If the user is not signed in (401), we fall back to
// localStorage so unauthenticated users can still demo the app.

async function apiFetch<T>(url: string, options?: RequestInit): Promise<T | null> {
  const res = await fetch(url, options);
  if (res.status === 401) return null; // not signed in → localStorage fallback
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(text);
  }
  return res.json() as Promise<T>;
}

// ── Date hydration ────────────────────────────────────────────────────────────

type RawCard = {
  id: string;
  word_id: string;
  status: string;
  fsrs_state: { due: string; last_review?: string; [k: string]: unknown };
  created_at: string;
};

type RawReview = {
  id: string;
  card_id: string;
  word_id: string;
  rating: number;
  timestamp: string;
  session_id: string;
  review_duration_ms: number | null;
  state_before: number;
  state_after: number;
};

function hydrateCard(row: RawCard): UserFlashcard {
  return {
    id: row.id,
    word_id: row.word_id,
    status: row.status as WordStatus,
    fsrs_state: {
      ...(row.fsrs_state as unknown as FSRSCard),
      due: new Date(row.fsrs_state.due),
      last_review: row.fsrs_state.last_review
        ? new Date(row.fsrs_state.last_review)
        : undefined,
      learning_steps: ((row.fsrs_state as unknown as FSRSCard).learning_steps) ?? 0,
    },
    created_at: new Date(row.created_at),
  };
}

function hydrateReview(row: RawReview): ReviewLogEntry {
  return {
    id: row.id,
    card_id: row.card_id,
    word_id: row.word_id,
    rating: row.rating as Rating,
    timestamp: new Date(row.timestamp),
    session_id: row.session_id,
    review_duration_ms: row.review_duration_ms ?? undefined,
    state_before: row.state_before as FSRSState,
    state_after: row.state_after as FSRSState,
  };
}

function cardToBody(card: UserFlashcard) {
  return {
    id: card.id,
    word_id: card.word_id,
    status: card.status,
    fsrs_state: {
      ...card.fsrs_state,
      due: card.fsrs_state.due.toISOString(),
      last_review: card.fsrs_state.last_review?.toISOString(),
    },
    created_at: card.created_at.toISOString(),
  };
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function saveFlashcards(cards: UserFlashcard[]): Promise<void> {
  const result = await apiFetch<{ ok: boolean }>("/api/flashcards/cards", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(cards.map(cardToBody)),
  });
  if (result === null) await localFlashcardStorage.saveFlashcards(cards);
}

export async function getFlashcards(): Promise<UserFlashcard[]> {
  const rows = await apiFetch<RawCard[]>("/api/flashcards/cards");
  if (rows === null) return localFlashcardStorage.getFlashcards();
  return rows.map(hydrateCard);
}

export async function addFlashcard(card: UserFlashcard): Promise<void> {
  const result = await apiFetch<{ ok: boolean }>("/api/flashcards/cards", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(cardToBody(card)),
  });
  if (result === null) await localFlashcardStorage.addFlashcard(card);
}

export async function updateFlashcard(
  cardId: string,
  updates: Partial<UserFlashcard>
): Promise<void> {
  const body: Record<string, unknown> = {};
  if (updates.word_id !== undefined) body.word_id = updates.word_id;
  if (updates.status !== undefined) body.status = updates.status;
  if (updates.fsrs_state !== undefined) {
    body.fsrs_state = {
      ...updates.fsrs_state,
      due: updates.fsrs_state.due.toISOString(),
      last_review: updates.fsrs_state.last_review?.toISOString(),
    };
  }

  const result = await apiFetch<{ ok: boolean }>(`/api/flashcards/cards/${cardId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (result === null) await localFlashcardStorage.updateFlashcard(cardId, updates);
}

export async function deleteFlashcard(cardId: string): Promise<void> {
  const result = await apiFetch<{ ok: boolean }>(`/api/flashcards/cards/${cardId}`, {
    method: "DELETE",
  });
  if (result === null) await localFlashcardStorage.deleteFlashcard(cardId);
}

export async function getFlashcardByWordId(wordId: string): Promise<UserFlashcard | null> {
  const row = await apiFetch<RawCard | null>(
    `/api/flashcards/cards/word/${encodeURIComponent(wordId)}`
  );
  if (row === null) return localFlashcardStorage.getFlashcardByWordId(wordId);
  if (!row) return null;
  return hydrateCard(row);
}

export async function saveFSRSState(cardId: string, state: FSRSCard): Promise<void> {
  await updateFlashcard(cardId, { fsrs_state: state });
}

export async function getFSRSState(cardId: string): Promise<FSRSCard | null> {
  const cards = await getFlashcards();
  return cards.find((c) => c.id === cardId)?.fsrs_state ?? null;
}

export async function saveReviewLog(log: ReviewLogEntry): Promise<void> {
  const result = await apiFetch<{ ok: boolean }>("/api/flashcards/reviews", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      id: log.id,
      card_id: log.card_id,
      word_id: log.word_id,
      rating: log.rating,
      timestamp: log.timestamp.toISOString(),
      session_id: log.session_id,
      review_duration_ms: log.review_duration_ms ?? null,
      state_before: log.state_before,
      state_after: log.state_after,
    }),
  });
  if (result === null) await localFlashcardStorage.saveReviewLog(log);
}

export async function getReviewLog(filters?: ReviewLogFilters): Promise<ReviewLogEntry[]> {
  const params = new URLSearchParams();
  if (filters?.session_id) params.set("session_id", filters.session_id);
  if (filters?.word_id) params.set("word_id", filters.word_id);
  if (filters?.rating) params.set("rating", String(filters.rating));
  if (filters?.start_date) params.set("start_date", filters.start_date.toISOString());
  if (filters?.end_date) params.set("end_date", filters.end_date.toISOString());

  const url = `/api/flashcards/reviews${params.toString() ? `?${params}` : ""}`;
  const rows = await apiFetch<RawReview[]>(url);
  if (rows === null) return localFlashcardStorage.getReviewLog(filters);
  return rows.map(hydrateReview);
}

export async function deleteReviewLogEntry(logId: string): Promise<void> {
  const result = await apiFetch<{ ok: boolean }>(`/api/flashcards/reviews/${logId}`, {
    method: "DELETE",
  });
  if (result === null) {
    try {
      const raw = localStorage.getItem("qalamspace_reviews");
      if (raw) {
        const entries = JSON.parse(raw) as { id: string }[];
        localStorage.setItem(
          "qalamspace_reviews",
          JSON.stringify(entries.filter((e) => e.id !== logId))
        );
      }
    } catch { /* ignore */ }
  }
}

export async function savePreferences(prefs: UserPreferences): Promise<void> {
  const result = await apiFetch<{ ok: boolean }>("/api/flashcards/preferences", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(prefs),
  });
  if (result === null) await localFlashcardStorage.savePreferences(prefs);
}

export async function getPreferences(): Promise<UserPreferences> {
  const row = await apiFetch<Record<string, unknown>>("/api/flashcards/preferences");
  if (row === null) return localFlashcardStorage.getPreferences();
  if (!row) return DEFAULT_PREFERENCES;
  return {
    show_arabic_explanation: row.show_arabic_explanation as boolean,
    show_root: row.show_root as boolean,
    show_ayah_examples: row.show_ayah_examples as boolean,
    include_particles: row.include_particles as boolean,
    include_proper_nouns: row.include_proper_nouns as boolean,
    auto_audio: row.auto_audio as boolean,
    show_transliteration: row.show_transliteration as boolean,
    daily_new_cards_limit: row.daily_new_cards_limit as number,
    daily_review_cards_limit: row.daily_review_cards_limit as number,
    session_size: row.session_size as number,
    normalization_level: row.normalization_level as "strict" | "moderate" | "broad",
    algorithm: getAlgorithmPreference(),
  };
}

export async function resetAllData(): Promise<void> {
  const result = await apiFetch<{ ok: boolean }>("/api/flashcards/reset", {
    method: "DELETE",
  });
  if (result === null) await localFlashcardStorage.resetAllData();
}

export async function exportData(): Promise<string> {
  const [flashcards, reviews, preferences] = await Promise.all([
    getFlashcards(),
    getReviewLog(),
    getPreferences(),
  ]);
  return JSON.stringify(
    { flashcards, reviews, preferences, exported_at: new Date().toISOString(), version: "1.0.0" },
    null,
    2
  );
}

export async function importData(jsonData: string): Promise<void> {
  try {
    const data = JSON.parse(jsonData);

    if (data.flashcards && Array.isArray(data.flashcards)) {
      const cards = data.flashcards.map(
        (card: {
          created_at: string;
          fsrs_state: { due: string; last_review?: string } & Omit<FSRSCard, "due" | "last_review">;
        } & Omit<UserFlashcard, "created_at" | "fsrs_state">) => ({
          ...card,
          created_at: new Date(card.created_at),
          fsrs_state: {
            ...card.fsrs_state,
            due: new Date(card.fsrs_state.due),
            last_review: card.fsrs_state.last_review
              ? new Date(card.fsrs_state.last_review)
              : undefined,
          },
        })
      );
      await saveFlashcards(cards);
    }

    if (data.preferences) await savePreferences(data.preferences);

    if (data.reviews && Array.isArray(data.reviews)) {
      for (const review of data.reviews as Array<
        Omit<ReviewLogEntry, "timestamp"> & { timestamp: string }
      >) {
        await saveReviewLog({ ...review, timestamp: new Date(review.timestamp) });
      }
    }
  } catch (error) {
    console.error("Failed to import data:", error);
    throw new Error("Failed to import data");
  }
}

export async function migrateFromLocalStorage(): Promise<boolean> {
  if (typeof window === "undefined") return false;

  const STORAGE_KEYS = {
    FLASHCARDS: "qalamspace_flashcards",
    REVIEWS: "qalamspace_reviews",
    PREFERENCES: "qalamspace_preferences",
    MIGRATED: "qalamspace_migrated_to_supabase",
  };

  if (localStorage.getItem(STORAGE_KEYS.MIGRATED) === "true") return false;

  // Only migrate if signed in — don't migrate anonymous demo data
  const testCall = await apiFetch<unknown>("/api/flashcards/cards");
  if (testCall === null) return false;

  try {
    const flashcardsJson = localStorage.getItem(STORAGE_KEYS.FLASHCARDS);
    const reviewsJson = localStorage.getItem(STORAGE_KEYS.REVIEWS);
    const prefsJson = localStorage.getItem(STORAGE_KEYS.PREFERENCES);

    if (!flashcardsJson && !reviewsJson && !prefsJson) {
      localStorage.setItem(STORAGE_KEYS.MIGRATED, "true");
      return false;
    }

    await importData(
      JSON.stringify({
        flashcards: flashcardsJson ? JSON.parse(flashcardsJson) : [],
        reviews: reviewsJson ? JSON.parse(reviewsJson) : [],
        preferences: prefsJson ? JSON.parse(prefsJson) : null,
        version: "1.0.0",
      })
    );

    localStorage.setItem(STORAGE_KEYS.MIGRATED, "true");
    console.log("Migrated localStorage flashcard data to Supabase.");
    return true;
  } catch (error) {
    console.error("Failed to migrate from localStorage:", error);
    return false;
  }
}
