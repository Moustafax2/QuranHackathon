/**
 * SM-2 (SuperMemo 2) Algorithm Implementation
 *
 * This is the original spaced repetition algorithm by Piotr Wozniak (1987),
 * as used by Anki in legacy mode. It is simpler than FSRS but less accurate
 * at modeling human memory.
 *
 * Reference: https://www.supermemo.com/en/blog/application-of-a-computer-to-improve-the-results-obtained-in-working-with-the-supermemo-method
 *
 * Key differences vs FSRS:
 *  - SM-2 uses a fixed easiness factor per card; FSRS models stability and difficulty separately.
 *  - SM-2 has no concept of stability growth curves; FSRS uses a power-law forgetting model.
 *  - SM-2 cannot distinguish "Hard" from "Again" in terms of interval resets as precisely as FSRS.
 *  - FSRS is significantly more accurate at predicting the optimal review time.
 */

import type { SM2Card, UserFlashcard, Rating } from "@/lib/types/flashcard";

const DEFAULT_EASINESS = 2.5;
const MIN_EASINESS = 1.3;

/**
 * Convert our 1-4 rating to SM-2's 0-5 quality scale.
 *
 * SM-2 original scale:
 *   5 - perfect response
 *   4 - correct response after a hesitation
 *   3 - correct response with serious difficulty
 *   2 - incorrect; correct answer seemed easy to recall
 *   1 - incorrect; correct answer was hard
 *   0 - complete blackout
 *
 * q < 3 → fail (reset repetitions)
 * q >= 3 → pass
 */
function ratingToQ(rating: Rating): number {
  switch (rating) {
    case 1: return 1;  // Again → fail (reset)
    case 2: return 3;  // Hard  → barely passing
    case 3: return 4;  // Good  → correct with minor hesitation
    case 4: return 5;  // Easy  → perfect response
    default: return 4;
  }
}

export function createNewSM2Card(): SM2Card {
  return {
    interval: 0,
    repetitions: 0,
    easiness: DEFAULT_EASINESS,
    due: new Date(),
    last_review: undefined,
  };
}

/**
 * Schedule the next review using SM-2.
 *
 * Algorithm:
 *  if q < 3:
 *    repetitions = 0; interval = 1
 *  else:
 *    if n==0: interval = 1
 *    elif n==1: interval = 6
 *    else: interval = round(prev_interval * EF)
 *    repetitions += 1
 *  EF = max(1.3, EF + 0.1 - (5-q)(0.08 + (5-q)*0.02))
 *  due = today + interval days
 */
export function scheduleSM2Review(
  card: SM2Card,
  rating: Rating,
  reviewDate: Date = new Date()
): SM2Card {
  const q = ratingToQ(rating);
  let { interval, repetitions, easiness } = card;

  if (q < 3) {
    // Failed: reset streak, review again tomorrow
    repetitions = 0;
    interval = 1;
  } else {
    // Passed
    if (repetitions === 0) {
      interval = 1;
    } else if (repetitions === 1) {
      interval = 6;
    } else {
      interval = Math.round(interval * easiness);
    }
    repetitions += 1;
  }

  // Update easiness factor (same regardless of pass/fail)
  const efDelta = 0.1 - (5 - q) * (0.08 + (5 - q) * 0.02);
  easiness = Math.max(MIN_EASINESS, easiness + efDelta);

  const due = new Date(reviewDate);
  due.setDate(due.getDate() + interval);

  return {
    interval,
    repetitions,
    easiness,
    due,
    last_review: reviewDate,
  };
}

/**
 * For SM-2 mode, determine which cards are due based on sm2_state.
 * Cards without a sm2_state are treated as due (new).
 */
export function getSM2DueCards(cards: UserFlashcard[]): UserFlashcard[] {
  const now = new Date();
  return cards.filter((card) => {
    if (!card.sm2_state) return true; // new card, treat as due
    return new Date(card.sm2_state.due) <= now;
  });
}

export function getSM2NewCards(cards: UserFlashcard[], limit: number): UserFlashcard[] {
  return cards
    .filter((card) => !card.sm2_state || card.sm2_state.repetitions === 0)
    .slice(0, limit);
}

export function getSM2CardsForSession(
  cards: UserFlashcard[],
  newLimit: number,
  reviewLimit: number
): UserFlashcard[] {
  const now = new Date();

  const newCards = cards
    .filter((c) => !c.sm2_state || c.sm2_state.repetitions === 0)
    .slice(0, newLimit);

  const reviewCards = cards
    .filter((c) => {
      if (!c.sm2_state || c.sm2_state.repetitions === 0) return false;
      return new Date(c.sm2_state.due) <= now;
    })
    .slice(0, reviewLimit);

  return [...reviewCards, ...newCards];
}
