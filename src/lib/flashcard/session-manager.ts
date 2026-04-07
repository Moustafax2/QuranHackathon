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
  deleteReviewLogEntry,
  getPreferences,
  getFSRSParameters,
  getAllSM2States,
  saveSM2State,
} from "@/lib/storage/flashcard-storage-supabase";
import { scheduleReviewWithParams, getCardsForSession } from "@/lib/fsrs/scheduler";
import {
  scheduleSM2Review,
  createNewSM2Card,
  getSM2CardsForSession,
} from "@/lib/sm2/scheduler";

export async function createReviewSession(): Promise<FlashcardSession | null> {
  const cards = await getFlashcards();
  const prefs = await getPreferences();
  const algorithm = prefs.algorithm ?? "fsrs";

  let sessionCards: UserFlashcard[];

  if (algorithm === "sm2") {
    // Merge SM-2 states from localStorage into the cards
    const sm2States = getAllSM2States();
    const cardsWithSM2 = cards.map((card) => ({
      ...card,
      sm2_state: sm2States[card.id] ?? undefined,
    }));
    sessionCards = getSM2CardsForSession(
      cardsWithSM2,
      prefs.daily_new_cards_limit,
      prefs.daily_review_cards_limit
    );
  } else {
    sessionCards = getCardsForSession(
      cards,
      prefs.daily_new_cards_limit,
      prefs.daily_review_cards_limit
    );
  }

  if (sessionCards.length === 0) return null;

  const sliced = sessionCards.slice(0, prefs.session_size || 20);

  const session: FlashcardSession = {
    id: crypto.randomUUID(),
    cards: sliced,
    current_index: 0,
    start_time: new Date(),
    algorithm,
    stats: {
      total_cards: sliced.length,
      cards_reviewed: 0,
      new_cards: sliced.filter((c) =>
        algorithm === "sm2"
          ? !c.sm2_state || c.sm2_state.repetitions === 0
          : c.fsrs_state.state === FSRSState.New
      ).length,
      review_cards: sliced.filter((c) =>
        algorithm === "sm2"
          ? c.sm2_state && c.sm2_state.repetitions > 0
          : c.fsrs_state.state !== FSRSState.New
      ).length,
      again_count: 0,
      hard_count: 0,
      good_count: 0,
      easy_count: 0,
      total_time_ms: 0,
    },
  };

  return session;
}

export async function undoReview(
  cardId: string,
  prevFsrsState: import("@/lib/types/flashcard").FSRSCard,
  logId: string
): Promise<void> {
  await Promise.all([
    updateFlashcard(cardId, { fsrs_state: prevFsrsState }),
    deleteReviewLogEntry(logId),
  ]);
}

export async function reviewCard(
  session: FlashcardSession,
  cardId: string,
  rating: Rating,
  reviewDurationMs: number = 0
): Promise<{ updatedSession: FlashcardSession; logId: string }> {
  const card = session.cards.find((c) => c.id === cardId);
  if (!card) throw new Error("Card not found in session");

  const algorithm = session.algorithm ?? "fsrs";
  const stateBefore = card.fsrs_state.state;
  let stateAfter = stateBefore;

  // ── Schedule with the active algorithm ──────────────────────
  let updatedCard: UserFlashcard;

  if (algorithm === "sm2") {
    const currentSM2 = card.sm2_state ?? createNewSM2Card();
    const newSM2State = scheduleSM2Review(currentSM2, rating);
    saveSM2State(card.id, newSM2State);
    updatedCard = { ...card, sm2_state: newSM2State };
    // FSRS state is left unchanged when in SM-2 mode
  } else {
    const fsrsParams = getFSRSParameters();
    const { card: newFSRSState } = scheduleReviewWithParams(
      card.fsrs_state,
      rating,
      fsrsParams
    );
    stateAfter = newFSRSState.state;
    await updateFlashcard(cardId, { fsrs_state: newFSRSState });
    updatedCard = { ...card, fsrs_state: newFSRSState };
  }

  // ── Review log (FSRS-state based; SM-2 still logs for history) ──
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

  // ── Update stats ──────────────────────────────────────────────
  const updatedStats = { ...session.stats };
  updatedStats.cards_reviewed += 1;
  updatedStats.total_time_ms += reviewDurationMs;
  switch (rating) {
    case 1: updatedStats.again_count += 1; break;
    case 2: updatedStats.hard_count  += 1; break;
    case 3: updatedStats.good_count  += 1; break;
    case 4: updatedStats.easy_count  += 1; break;
  }

  // ── Build updated cards array ─────────────────────────────────
  let updatedCards = [...session.cards];
  updatedCards[session.current_index] = updatedCard;

  let nextIndex = session.current_index + 1;

  if (rating === 1) {
    // "Again" — re-queue ~3 cards later so the card appears again this session
    updatedCards.splice(session.current_index, 1);
    const insertAt = Math.min(session.current_index + 3, updatedCards.length);
    updatedCards.splice(insertAt, 0, updatedCard);
    nextIndex = session.current_index; // next card is now at the same index
  }

  const updatedSession: FlashcardSession = {
    ...session,
    cards: updatedCards,
    current_index: nextIndex,
    stats: updatedStats,
  };

  return { updatedSession, logId: reviewLog.id };
}

export function isSessionComplete(session: FlashcardSession): boolean {
  return session.current_index >= session.cards.length;
}

export function getCurrentCard(session: FlashcardSession): UserFlashcard | null {
  if (isSessionComplete(session)) return null;
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
  return ((stats.good_count + stats.easy_count) / total) * 100;
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
  ratings: { again: number; hard: number; good: number; easy: number };
}> {
  return {
    cardsReviewed: session.stats.cards_reviewed,
    accuracy: calculateAccuracy(session.stats),
    totalTime: session.stats.total_time_ms,
    averageTime: getAverageReviewTime(session.stats),
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
  const prefs = await getPreferences();
  const now = new Date();

  if (prefs.algorithm === "sm2") {
    const sm2States = getAllSM2States();
    return cards.filter((card) => {
      const state = sm2States[card.id];
      if (!state) return true;
      return new Date(state.due) <= now;
    }).length;
  }

  return cards.filter((card) => new Date(card.fsrs_state.due) <= now).length;
}

export async function getNewCardsCount(): Promise<number> {
  const cards = await getFlashcards();
  const prefs = await getPreferences();

  if (prefs.algorithm === "sm2") {
    const sm2States = getAllSM2States();
    return cards.filter((card) => {
      const state = sm2States[card.id];
      return !state || state.repetitions === 0;
    }).length;
  }

  return cards.filter((card) => card.fsrs_state.state === FSRSState.New).length;
}
