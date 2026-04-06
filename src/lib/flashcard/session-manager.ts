import type {
  FlashcardSession,
  UserFlashcard,
  ReviewLogEntry,
  Rating,
  SessionStats,
} from "@/lib/types/flashcard";
import { FSRSState } from "@/lib/types/flashcard";
import {
  getFlashcards,
  updateFlashcard,
  saveReviewLog,
  getPreferences,
} from "@/lib/storage/flashcard-storage";
import { scheduleReview, getCardsForSession } from "@/lib/fsrs/scheduler";

export async function createReviewSession(): Promise<FlashcardSession | null> {
  const cards = await getFlashcards();
  const prefs = await getPreferences();
  
  const sessionCards = getCardsForSession(
    cards,
    prefs.daily_new_cards_limit,
    prefs.daily_review_cards_limit
  );
  
  if (sessionCards.length === 0) {
    return null;
  }
  
  const session: FlashcardSession = {
    id: crypto.randomUUID(),
    cards: sessionCards.slice(0, prefs.session_size),
    current_index: 0,
    start_time: new Date(),
    stats: {
      total_cards: sessionCards.length,
      cards_reviewed: 0,
      new_cards: sessionCards.filter((c) => c.fsrs_state.state === FSRSState.New).length,
      review_cards: sessionCards.filter((c) => c.fsrs_state.state !== FSRSState.New).length,
      again_count: 0,
      hard_count: 0,
      good_count: 0,
      easy_count: 0,
      total_time_ms: 0,
    },
  };
  
  return session;
}

export async function reviewCard(
  session: FlashcardSession,
  cardId: string,
  rating: Rating,
  reviewDurationMs: number = 0
): Promise<FlashcardSession> {
  const card = session.cards.find((c) => c.id === cardId);
  if (!card) {
    throw new Error("Card not found in session");
  }
  
  const stateBefore = card.fsrs_state.state;
  const { card: newFSRSState } = scheduleReview(card.fsrs_state, rating);
  const stateAfter = newFSRSState.state;
  
  await updateFlashcard(cardId, { fsrs_state: newFSRSState });
  
  const reviewLog: ReviewLogEntry = {
    id: crypto.randomUUID(),
    card_id: cardId,
    word_id: card.word_id,
    rating,
    timestamp: new Date(),
    session_id: session.id,
    review_duration_ms: reviewDurationMs,
    state_before: stateBefore,
    state_after: stateAfter,
  };
  
  await saveReviewLog(reviewLog);
  
  const updatedStats = { ...session.stats };
  updatedStats.cards_reviewed += 1;
  updatedStats.total_time_ms += reviewDurationMs;
  
  switch (rating) {
    case 1:
      updatedStats.again_count += 1;
      break;
    case 2:
      updatedStats.hard_count += 1;
      break;
    case 3:
      updatedStats.good_count += 1;
      break;
    case 4:
      updatedStats.easy_count += 1;
      break;
  }
  
  const updatedSession: FlashcardSession = {
    ...session,
    current_index: session.current_index + 1,
    stats: updatedStats,
  };
  
  return updatedSession;
}

export function isSessionComplete(session: FlashcardSession): boolean {
  return session.current_index >= session.cards.length;
}

export function getCurrentCard(session: FlashcardSession): UserFlashcard | null {
  if (isSessionComplete(session)) {
    return null;
  }
  return session.cards[session.current_index];
}

export function getSessionProgress(session: FlashcardSession): {
  current: number;
  total: number;
  percentage: number;
} {
  return {
    current: session.current_index,
    total: session.cards.length,
    percentage: (session.current_index / session.cards.length) * 100,
  };
}

export function calculateAccuracy(stats: SessionStats): number {
  const total = stats.cards_reviewed;
  if (total === 0) return 0;
  
  const correct = stats.good_count + stats.easy_count;
  return (correct / total) * 100;
}

export function getAverageReviewTime(stats: SessionStats): number {
  if (stats.cards_reviewed === 0) return 0;
  return stats.total_time_ms / stats.cards_reviewed;
}

export async function getSessionSummary(session: FlashcardSession): Promise<{
  cardsReviewed: number;
  accuracy: number;
  totalTime: number;
  averageTime: number;
  newCards: number;
  reviewCards: number;
  ratings: {
    again: number;
    hard: number;
    good: number;
    easy: number;
  };
}> {
  const accuracy = calculateAccuracy(session.stats);
  const averageTime = getAverageReviewTime(session.stats);
  
  return {
    cardsReviewed: session.stats.cards_reviewed,
    accuracy,
    totalTime: session.stats.total_time_ms,
    averageTime,
    newCards: session.stats.new_cards,
    reviewCards: session.stats.review_cards,
    ratings: {
      again: session.stats.again_count,
      hard: session.stats.hard_count,
      good: session.stats.good_count,
      easy: session.stats.easy_count,
    },
  };
}

export async function getDueCardsCount(): Promise<number> {
  const cards = await getFlashcards();
  const now = new Date();
  return cards.filter((card) => new Date(card.fsrs_state.due) <= now).length;
}

export async function getNewCardsCount(): Promise<number> {
  const cards = await getFlashcards();
  return cards.filter((card) => card.fsrs_state.state === FSRSState.New).length;
}
