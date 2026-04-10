"use client";

import type {
  UserFlashcard,
  ReviewLogEntry,
  ReviewLogFilters,
  UserPreferences,
  FSRSCard,
} from "@/lib/types/flashcard";
import { DEFAULT_PREFERENCES } from "@/lib/types/flashcard";

const STORAGE_KEYS = {
  FLASHCARDS: "qalamspace_flashcards",
  REVIEWS: "qalamspace_reviews",
  PREFERENCES: "qalamspace_preferences",
} as const;

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

function parseJSON<T>(json: string | null, fallback: T): T {
  if (!json) return fallback;
  try {
    return JSON.parse(json, (key, value) => {
      if (key === "due" || key === "last_review" || key === "created_at" || key === "timestamp" || key === "start_time" || key === "end_time") {
        return value ? new Date(value) : value;
      }
      return value;
    }) as T;
  } catch {
    return fallback;
  }
}

export async function saveFlashcards(cards: UserFlashcard[]): Promise<void> {
  if (!isBrowser()) return;
  
  try {
    const json = JSON.stringify(cards);
    localStorage.setItem(STORAGE_KEYS.FLASHCARDS, json);
  } catch (error) {
    console.error("Failed to save flashcards:", error);
    throw new Error("Failed to save flashcards to storage");
  }
}

export async function getFlashcards(): Promise<UserFlashcard[]> {
  if (!isBrowser()) return [];
  
  try {
    const json = localStorage.getItem(STORAGE_KEYS.FLASHCARDS);
    return parseJSON<UserFlashcard[]>(json, []);
  } catch (error) {
    console.error("Failed to load flashcards:", error);
    return [];
  }
}

export async function addFlashcard(card: UserFlashcard): Promise<void> {
  const cards = await getFlashcards();
  const existingIndex = cards.findIndex((c) => c.word_id === card.word_id);
  
  if (existingIndex >= 0) {
    cards[existingIndex] = card;
  } else {
    cards.push(card);
  }
  
  await saveFlashcards(cards);
}

export async function updateFlashcard(cardId: string, updates: Partial<UserFlashcard>): Promise<void> {
  const cards = await getFlashcards();
  const index = cards.findIndex((c) => c.id === cardId);
  
  if (index >= 0) {
    cards[index] = { ...cards[index], ...updates };
    await saveFlashcards(cards);
  }
}

export async function deleteFlashcard(cardId: string): Promise<void> {
  const cards = await getFlashcards();
  const filtered = cards.filter((c) => c.id !== cardId);
  await saveFlashcards(filtered);
}

export async function getFlashcardByWordId(wordId: string): Promise<UserFlashcard | null> {
  const cards = await getFlashcards();
  return cards.find((c) => c.word_id === wordId) || null;
}

export async function saveFSRSState(cardId: string, state: FSRSCard): Promise<void> {
  const cards = await getFlashcards();
  const index = cards.findIndex((c) => c.id === cardId);
  
  if (index >= 0) {
    cards[index].fsrs_state = state;
    await saveFlashcards(cards);
  }
}

export async function getFSRSState(cardId: string): Promise<FSRSCard | null> {
  const cards = await getFlashcards();
  const card = cards.find((c) => c.id === cardId);
  return card?.fsrs_state || null;
}

export async function saveReviewLog(log: ReviewLogEntry): Promise<void> {
  if (!isBrowser()) return;
  
  try {
    const logs = await getReviewLog();
    logs.push(log);
    const json = JSON.stringify(logs);
    localStorage.setItem(STORAGE_KEYS.REVIEWS, json);
  } catch (error) {
    console.error("Failed to save review log:", error);
    throw new Error("Failed to save review log to storage");
  }
}

export async function getReviewLog(filters?: ReviewLogFilters): Promise<ReviewLogEntry[]> {
  if (!isBrowser()) return [];
  
  try {
    const json = localStorage.getItem(STORAGE_KEYS.REVIEWS);
    let logs = parseJSON<ReviewLogEntry[]>(json, []);
    
    if (filters) {
      if (filters.session_id) {
        logs = logs.filter((log) => log.session_id === filters.session_id);
      }
      if (filters.word_id) {
        logs = logs.filter((log) => log.word_id === filters.word_id);
      }
      if (filters.rating) {
        logs = logs.filter((log) => log.rating === filters.rating);
      }
      if (filters.start_date) {
        logs = logs.filter((log) => log.timestamp >= filters.start_date!);
      }
      if (filters.end_date) {
        logs = logs.filter((log) => log.timestamp <= filters.end_date!);
      }
    }
    
    return logs;
  } catch (error) {
    console.error("Failed to load review log:", error);
    return [];
  }
}

export async function savePreferences(prefs: UserPreferences): Promise<void> {
  if (!isBrowser()) return;
  
  try {
    const json = JSON.stringify(prefs);
    localStorage.setItem(STORAGE_KEYS.PREFERENCES, json);
  } catch (error) {
    console.error("Failed to save preferences:", error);
    throw new Error("Failed to save preferences to storage");
  }
}

export async function getPreferences(): Promise<UserPreferences> {
  if (!isBrowser()) return DEFAULT_PREFERENCES;
  
  try {
    const json = localStorage.getItem(STORAGE_KEYS.PREFERENCES);
    const prefs = parseJSON<UserPreferences | null>(json, null);
    return prefs ? { ...DEFAULT_PREFERENCES, ...prefs } : DEFAULT_PREFERENCES;
  } catch (error) {
    console.error("Failed to load preferences:", error);
    return DEFAULT_PREFERENCES;
  }
}

export async function resetAllData(): Promise<void> {
  if (!isBrowser()) return;
  
  try {
    localStorage.removeItem(STORAGE_KEYS.FLASHCARDS);
    localStorage.removeItem(STORAGE_KEYS.REVIEWS);
    localStorage.removeItem(STORAGE_KEYS.PREFERENCES);
  } catch (error) {
    console.error("Failed to reset data:", error);
    throw new Error("Failed to reset data");
  }
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
  try {
    const data = JSON.parse(jsonData);
    
    if (data.flashcards) {
      await saveFlashcards(data.flashcards);
    }
    if (data.preferences) {
      await savePreferences(data.preferences);
    }
    if (data.reviews && isBrowser()) {
      localStorage.setItem(STORAGE_KEYS.REVIEWS, JSON.stringify(data.reviews));
    }
  } catch (error) {
    console.error("Failed to import data:", error);
    throw new Error("Failed to import data");
  }
}
