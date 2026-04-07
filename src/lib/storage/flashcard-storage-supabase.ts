"use client";

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

// ──────────────────────────────────────────────────────────────────
// localStorage keys for client-side-only preferences
// ──────────────────────────────────────────────────────────────────

const FSRS_PARAMS_KEY    = "qalamspace_fsrs_params";
const SM2_STATES_KEY     = "qalamspace_sm2_states";
const ALGORITHM_KEY      = "qalamspace_algorithm";

// ── FSRS parameters ──

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

// ── Algorithm preference ──

export function getAlgorithmPreference(): "fsrs" | "sm2" {
  if (typeof window === "undefined") return "fsrs";
  return (localStorage.getItem(ALGORITHM_KEY) as "fsrs" | "sm2") ?? "fsrs";
}

export function saveAlgorithmPreference(algo: "fsrs" | "sm2"): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(ALGORITHM_KEY, algo);
}

// ── SM-2 card states (keyed by card id) ──

export function getAllSM2States(): Record<string, SM2Card> {
  if (typeof window === "undefined") return {};
  try {
    const json = localStorage.getItem(SM2_STATES_KEY);
    if (!json) return {};
    const raw = JSON.parse(json) as Record<string, SM2Card & { due: string; last_review?: string }>;
    // Hydrate Date fields
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

import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/lib/supabase/types";
import * as localFlashcardStorage from "@/lib/storage/flashcard-storage";

const DUMMY_USER_ID = "dev-dummy-user";
const AUTH_MISSING_ERROR = "Auth session missing";
type UserFlashcardRow = Database["public"]["Tables"]["user_flashcards"]["Row"];
type UserFlashcardInsert = Database["public"]["Tables"]["user_flashcards"]["Insert"];
type UserFlashcardUpdate = Database["public"]["Tables"]["user_flashcards"]["Update"];
type ReviewLogRow = Database["public"]["Tables"]["review_log"]["Row"];
type UserPreferencesRow = Database["public"]["Tables"]["user_preferences"]["Row"];

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

function shouldUseLocalFallback(error: unknown): boolean {
  if (!isBrowser()) return false;
  if (!error) return true;
  if (error instanceof Error) {
    return error.message.includes(AUTH_MISSING_ERROR);
  }
  if (typeof error === "object" && error && "message" in error) {
    const message = String((error as { message?: unknown }).message ?? "");
    return message.includes(AUTH_MISSING_ERROR);
  }
  return false;
}

async function getCurrentUserId(): Promise<string | null> {
  const supabase = createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  
  if (error || !user) {
    if (shouldUseLocalFallback(error)) {
      return DUMMY_USER_ID;
    }

    console.error("Failed to get current user:", error);
    return null;
  }
  
  return user.id;
}

function isDummyUser(userId: string | null): userId is typeof DUMMY_USER_ID {
  return userId === DUMMY_USER_ID;
}

function convertFSRSCardFromDB(fsrsState: UserFlashcardRow["fsrs_state"]): FSRSCard {
  return {
    ...fsrsState,
    due: new Date(fsrsState.due),
    last_review: fsrsState.last_review ? new Date(fsrsState.last_review) : undefined,
    // learning_steps was added in ts-fsrs v5; default to 0 for cards created before this field existed
    learning_steps: ((fsrsState as unknown) as FSRSCard).learning_steps ?? 0,
  };
}

function convertFSRSCardToDB(fsrsState: FSRSCard): UserFlashcardRow["fsrs_state"] {
  return {
    ...fsrsState,
    due: fsrsState.due.toISOString(),
    last_review: fsrsState.last_review?.toISOString(),
  };
}

function mapUserFlashcardRow(card: UserFlashcardRow): UserFlashcard {
  return {
    id: card.id,
    word_id: card.word_id,
    fsrs_state: convertFSRSCardFromDB(card.fsrs_state),
    created_at: new Date(card.created_at),
    status: card.status as WordStatus,
  };
}

function mapReviewLogRow(log: ReviewLogRow): ReviewLogEntry {
  return {
    id: log.id,
    card_id: log.card_id,
    word_id: log.word_id,
    rating: log.rating as Rating,
    timestamp: new Date(log.timestamp),
    session_id: log.session_id,
    review_duration_ms: log.review_duration_ms ?? undefined,
    state_before: log.state_before as FSRSState,
    state_after: log.state_after as FSRSState,
  };
}

export async function saveFlashcards(cards: UserFlashcard[]): Promise<void> {
  const userId = await getCurrentUserId();
  if (!userId) {
    throw new Error("User not authenticated");
  }
  if (isDummyUser(userId)) {
    await localFlashcardStorage.saveFlashcards(cards);
    return;
  }

  const supabase = createClient();
  
  const dbCards: UserFlashcardInsert[] = cards.map(card => ({
    id: card.id,
    user_id: userId,
    word_id: card.word_id,
    status: card.status,
    fsrs_state: convertFSRSCardToDB(card.fsrs_state),
    created_at: card.created_at.toISOString(),
  }));

  const { error } = await supabase
    .from("user_flashcards")
    .upsert(dbCards, { onConflict: "id" });

  if (error) {
    console.error("Failed to save flashcards:", error);
    throw new Error("Failed to save flashcards to database");
  }
}

export async function getFlashcards(): Promise<UserFlashcard[]> {
  const userId = await getCurrentUserId();
  if (!userId) {
    return [];
  }
  if (isDummyUser(userId)) {
    return localFlashcardStorage.getFlashcards();
  }

  const supabase = createClient();
  
  const { data, error } = await supabase
    .from("user_flashcards")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Failed to load flashcards:", error);
    return [];
  }

  return (data || []).map(mapUserFlashcardRow);
}

export async function addFlashcard(card: UserFlashcard): Promise<void> {
  const userId = await getCurrentUserId();
  if (!userId) {
    throw new Error("User not authenticated");
  }
  if (isDummyUser(userId)) {
    await localFlashcardStorage.addFlashcard(card);
    return;
  }

  const supabase = createClient();
  
  const { error } = await supabase
    .from("user_flashcards")
    .upsert({
      id: card.id,
      user_id: userId,
      word_id: card.word_id,
      status: card.status,
      fsrs_state: convertFSRSCardToDB(card.fsrs_state),
      created_at: card.created_at.toISOString(),
    }, { onConflict: "user_id,word_id" });

  if (error) {
    console.error("Failed to add flashcard:", error);
    throw new Error("Failed to add flashcard to database");
  }
}

export async function updateFlashcard(cardId: string, updates: Partial<UserFlashcard>): Promise<void> {
  const userId = await getCurrentUserId();
  if (!userId) {
    throw new Error("User not authenticated");
  }
  if (isDummyUser(userId)) {
    await localFlashcardStorage.updateFlashcard(cardId, updates);
    return;
  }

  const supabase = createClient();
  
  const dbUpdates: UserFlashcardUpdate = {};
  
  if (updates.word_id !== undefined) dbUpdates.word_id = updates.word_id;
  if (updates.status !== undefined) dbUpdates.status = updates.status;
  if (updates.fsrs_state !== undefined) {
    dbUpdates.fsrs_state = convertFSRSCardToDB(updates.fsrs_state);
  }

  const { error } = await supabase
    .from("user_flashcards")
    .update(dbUpdates)
    .eq("id", cardId)
    .eq("user_id", userId);

  if (error) {
    console.error("Failed to update flashcard:", error);
    throw new Error("Failed to update flashcard in database");
  }
}

export async function deleteFlashcard(cardId: string): Promise<void> {
  const userId = await getCurrentUserId();
  if (!userId) {
    throw new Error("User not authenticated");
  }
  if (isDummyUser(userId)) {
    await localFlashcardStorage.deleteFlashcard(cardId);
    return;
  }

  const supabase = createClient();
  
  const { error } = await supabase
    .from("user_flashcards")
    .delete()
    .eq("id", cardId)
    .eq("user_id", userId);

  if (error) {
    console.error("Failed to delete flashcard:", error);
    throw new Error("Failed to delete flashcard from database");
  }
}

export async function getFlashcardByWordId(wordId: string): Promise<UserFlashcard | null> {
  const userId = await getCurrentUserId();
  if (!userId) {
    return null;
  }
  if (isDummyUser(userId)) {
    return localFlashcardStorage.getFlashcardByWordId(wordId);
  }

  const supabase = createClient();
  
  const { data, error } = await supabase
    .from("user_flashcards")
    .select("*")
    .eq("user_id", userId)
    .eq("word_id", wordId)
    .single();

  if (error || !data) {
    return null;
  }

  return {
    ...mapUserFlashcardRow(data),
  };
}

export async function saveFSRSState(cardId: string, state: FSRSCard): Promise<void> {
  await updateFlashcard(cardId, { fsrs_state: state });
}

export async function getFSRSState(cardId: string): Promise<FSRSCard | null> {
  const userId = await getCurrentUserId();
  if (!userId) {
    return null;
  }
  if (isDummyUser(userId)) {
    return localFlashcardStorage.getFSRSState(cardId);
  }

  const supabase = createClient();
  
  const { data, error } = await supabase
    .from("user_flashcards")
    .select("fsrs_state")
    .eq("id", cardId)
    .eq("user_id", userId)
    .single();

  if (error || !data) {
    return null;
  }

  return convertFSRSCardFromDB(data.fsrs_state);
}

export async function saveReviewLog(log: ReviewLogEntry): Promise<void> {
  const userId = await getCurrentUserId();
  if (!userId) {
    throw new Error("User not authenticated");
  }
  if (isDummyUser(userId)) {
    await localFlashcardStorage.saveReviewLog(log);
    return;
  }

  const supabase = createClient();
  
  const { error } = await supabase
    .from("review_log")
    .insert({
      id: log.id,
      user_id: userId,
      card_id: log.card_id,
      word_id: log.word_id,
      rating: log.rating,
      timestamp: log.timestamp.toISOString(),
      session_id: log.session_id,
      review_duration_ms: log.review_duration_ms,
      state_before: log.state_before,
      state_after: log.state_after,
    });

  if (error) {
    console.error("Failed to save review log:", error);
    throw new Error("Failed to save review log to database");
  }
}

export async function getReviewLog(filters?: ReviewLogFilters): Promise<ReviewLogEntry[]> {
  const userId = await getCurrentUserId();
  if (!userId) {
    return [];
  }
  if (isDummyUser(userId)) {
    return localFlashcardStorage.getReviewLog(filters);
  }

  const supabase = createClient();
  
  let query = supabase
    .from("review_log")
    .select("*")
    .eq("user_id", userId);

  if (filters) {
    if (filters.session_id) {
      query = query.eq("session_id", filters.session_id);
    }
    if (filters.word_id) {
      query = query.eq("word_id", filters.word_id);
    }
    if (filters.rating) {
      query = query.eq("rating", filters.rating);
    }
    if (filters.start_date) {
      query = query.gte("timestamp", filters.start_date.toISOString());
    }
    if (filters.end_date) {
      query = query.lte("timestamp", filters.end_date.toISOString());
    }
  }

  query = query.order("timestamp", { ascending: false });

  const { data, error } = await query;

  if (error) {
    console.error("Failed to load review log:", error);
    return [];
  }

  return (data || []).map(mapReviewLogRow);
}

export async function savePreferences(prefs: UserPreferences): Promise<void> {
  const userId = await getCurrentUserId();
  if (!userId) {
    throw new Error("User not authenticated");
  }
  if (isDummyUser(userId)) {
    await localFlashcardStorage.savePreferences(prefs);
    return;
  }

  const supabase = createClient();
  
  const { error } = await supabase
    .from("user_preferences")
    .upsert({
      user_id: userId,
      show_arabic_explanation: prefs.show_arabic_explanation,
      show_root: prefs.show_root,
      show_ayah_examples: prefs.show_ayah_examples,
      include_particles: prefs.include_particles,
      include_proper_nouns: prefs.include_proper_nouns,
      auto_audio: prefs.auto_audio,
      show_transliteration: prefs.show_transliteration,
      daily_new_cards_limit: prefs.daily_new_cards_limit,
      daily_review_cards_limit: prefs.daily_review_cards_limit,
      session_size: prefs.session_size,
      normalization_level: prefs.normalization_level,
    }, { onConflict: "user_id" });

  if (error) {
    console.error("Failed to save preferences:", error);
    throw new Error("Failed to save preferences to database");
  }
}

export async function getPreferences(): Promise<UserPreferences> {
  const userId = await getCurrentUserId();
  if (!userId) {
    return DEFAULT_PREFERENCES;
  }
  if (isDummyUser(userId)) {
    return localFlashcardStorage.getPreferences();
  }

  const supabase = createClient();
  
  const { data, error } = await supabase
    .from("user_preferences")
    .select("*")
    .eq("user_id", userId)
    .single();

  if (error || !data) {
    return DEFAULT_PREFERENCES;
  }

  const prefs: UserPreferencesRow = data;
  return {
    show_arabic_explanation: prefs.show_arabic_explanation,
    show_root: prefs.show_root,
    show_ayah_examples: prefs.show_ayah_examples,
    include_particles: prefs.include_particles,
    include_proper_nouns: prefs.include_proper_nouns,
    auto_audio: prefs.auto_audio,
    show_transliteration: prefs.show_transliteration,
    daily_new_cards_limit: prefs.daily_new_cards_limit,
    daily_review_cards_limit: prefs.daily_review_cards_limit,
    session_size: prefs.session_size,
    normalization_level: prefs.normalization_level,
    // algorithm is stored in localStorage, not Supabase
    algorithm: getAlgorithmPreference(),
  };
}

export async function resetAllData(): Promise<void> {
  const userId = await getCurrentUserId();
  if (!userId) {
    throw new Error("User not authenticated");
  }
  if (isDummyUser(userId)) {
    await localFlashcardStorage.resetAllData();
    return;
  }

  const supabase = createClient();
  
  await supabase.from("user_flashcards").delete().eq("user_id", userId);
  await supabase.from("review_log").delete().eq("user_id", userId);
  await supabase.from("user_preferences").delete().eq("user_id", userId);
}

export async function exportData(): Promise<string> {
  const flashcards = await getFlashcards();
  const reviews = await getReviewLog();
  const preferences = await getPreferences();
  
  return JSON.stringify({
    flashcards,
    reviews,
    preferences,
    exported_at: new Date().toISOString(),
    version: "1.0.0",
  }, null, 2);
}

export async function importData(jsonData: string): Promise<void> {
  const userId = await getCurrentUserId();
  if (isDummyUser(userId)) {
    await localFlashcardStorage.importData(jsonData);
    return;
  }

  try {
    const data = JSON.parse(jsonData);
    
    if (data.flashcards && Array.isArray(data.flashcards)) {
      const cards = data.flashcards.map((card: {
        created_at: string;
        fsrs_state: {
          due: string;
          last_review?: string;
        } & Omit<FSRSCard, "due" | "last_review">;
      } & Omit<UserFlashcard, "created_at" | "fsrs_state">) => ({
        ...card,
        created_at: new Date(card.created_at),
        fsrs_state: {
          ...card.fsrs_state,
          due: new Date(card.fsrs_state.due),
          last_review: card.fsrs_state.last_review ? new Date(card.fsrs_state.last_review) : undefined,
        },
      }));
      await saveFlashcards(cards);
    }
    
    if (data.preferences) {
      await savePreferences(data.preferences);
    }
    
    if (data.reviews && Array.isArray(data.reviews)) {
      for (const review of data.reviews as Array<Omit<ReviewLogEntry, "timestamp"> & { timestamp: string }>) {
        const reviewEntry: ReviewLogEntry = {
          ...review,
          timestamp: new Date(review.timestamp),
        };
        await saveReviewLog(reviewEntry);
      }
    }
  } catch (error) {
    console.error("Failed to import data:", error);
    throw new Error("Failed to import data");
  }
}

export async function migrateFromLocalStorage(): Promise<boolean> {
  if (typeof window === "undefined") return false;

  const userId = await getCurrentUserId();
  if (isDummyUser(userId)) {
    return false;
  }
  
  const STORAGE_KEYS = {
    FLASHCARDS: "qalamspace_flashcards",
    REVIEWS: "qalamspace_reviews",
    PREFERENCES: "qalamspace_preferences",
    MIGRATED: "qalamspace_migrated_to_supabase",
  };
  
  if (localStorage.getItem(STORAGE_KEYS.MIGRATED) === "true") {
    return false;
  }
  
  try {
    const flashcardsJson = localStorage.getItem(STORAGE_KEYS.FLASHCARDS);
    const reviewsJson = localStorage.getItem(STORAGE_KEYS.REVIEWS);
    const prefsJson = localStorage.getItem(STORAGE_KEYS.PREFERENCES);
    
    if (!flashcardsJson && !reviewsJson && !prefsJson) {
      localStorage.setItem(STORAGE_KEYS.MIGRATED, "true");
      return false;
    }
    
    const exportData = JSON.stringify({
      flashcards: flashcardsJson ? JSON.parse(flashcardsJson) : [],
      reviews: reviewsJson ? JSON.parse(reviewsJson) : [],
      preferences: prefsJson ? JSON.parse(prefsJson) : null,
      version: "1.0.0",
    });
    
    await importData(exportData);
    
    localStorage.setItem(STORAGE_KEYS.MIGRATED, "true");
    
    console.log("Successfully migrated data from localStorage to Supabase");
    return true;
  } catch (error) {
    console.error("Failed to migrate from localStorage:", error);
    return false;
  }
}
