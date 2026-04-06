import { FSRS, Rating as FSRSRating, Card, State } from "ts-fsrs";
import type { FSRSCard, UserFlashcard, Rating } from "@/lib/types/flashcard";
import { FSRSState } from "@/lib/types/flashcard";

const fsrs = new FSRS({
  request_retention: 0.9,
  maximum_interval: 365,
  w: [
    0.4, 0.6, 2.4, 5.8, 4.93, 0.94, 0.86, 0.01, 1.49, 0.14, 0.94, 2.18, 0.05,
    0.34, 1.26, 0.29, 2.61,
  ],
});

function mapRatingToGrade(rating: Rating): FSRSRating {
  switch (rating) {
    case 1:
      return FSRSRating.Again;
    case 2:
      return FSRSRating.Hard;
    case 3:
      return FSRSRating.Good;
    case 4:
      return FSRSRating.Easy;
    default:
      return FSRSRating.Good;
  }
}

function mapStateToFSRSState(state: State): FSRSState {
  switch (state) {
    case State.New:
      return FSRSState.New;
    case State.Learning:
      return FSRSState.Learning;
    case State.Review:
      return FSRSState.Review;
    case State.Relearning:
      return FSRSState.Relearning;
    default:
      return FSRSState.New;
  }
}

function mapFSRSStateToState(state: FSRSState): State {
  switch (state) {
    case FSRSState.New:
      return State.New;
    case FSRSState.Learning:
      return State.Learning;
    case FSRSState.Review:
      return State.Review;
    case FSRSState.Relearning:
      return State.Relearning;
    default:
      return State.New;
  }
}

function fsrsCardToCard(fsrsCard: FSRSCard): Card {
  return {
    due: fsrsCard.due,
    stability: fsrsCard.stability,
    difficulty: fsrsCard.difficulty,
    elapsed_days: fsrsCard.elapsed_days,
    scheduled_days: fsrsCard.scheduled_days,
    reps: fsrsCard.reps,
    lapses: fsrsCard.lapses,
    state: mapFSRSStateToState(fsrsCard.state),
    last_review: fsrsCard.last_review,
  } as Card;
}

function cardToFSRSCard(card: Card): FSRSCard {
  return {
    due: card.due,
    stability: card.stability,
    difficulty: card.difficulty,
    elapsed_days: card.elapsed_days,
    scheduled_days: card.scheduled_days,
    reps: card.reps,
    lapses: card.lapses,
    state: mapStateToFSRSState(card.state),
    last_review: card.last_review,
  };
}

export function createNewCard(): FSRSCard {
  return {
    due: new Date(),
    stability: 0,
    difficulty: 0,
    elapsed_days: 0,
    scheduled_days: 0,
    reps: 0,
    lapses: 0,
    state: FSRSState.New,
    last_review: undefined,
  };
}

export function scheduleReview(
  card: FSRSCard,
  rating: Rating,
  reviewDate: Date = new Date()
): { card: FSRSCard } {
  const fsrsCard = fsrsCardToCard(card);
  const grade = mapRatingToGrade(rating);
  const schedulingInfo = fsrs.repeat(fsrsCard, reviewDate);
  
  let result;
  if (grade === FSRSRating.Again) result = schedulingInfo[FSRSRating.Again];
  else if (grade === FSRSRating.Hard) result = schedulingInfo[FSRSRating.Hard];
  else if (grade === FSRSRating.Good) result = schedulingInfo[FSRSRating.Good];
  else result = schedulingInfo[FSRSRating.Easy];
  
  return {
    card: cardToFSRSCard(result.card),
  };
}

export function getDueCards(cards: UserFlashcard[]): UserFlashcard[] {
  const now = new Date();
  return cards.filter((card) => {
    const dueDate = new Date(card.fsrs_state.due);
    return dueDate <= now;
  });
}

export function getNewCards(
  cards: UserFlashcard[],
  limit: number
): UserFlashcard[] {
  return cards
    .filter((card) => card.fsrs_state.state === FSRSState.New)
    .slice(0, limit);
}

export function getLearningCards(cards: UserFlashcard[]): UserFlashcard[] {
  return cards.filter(
    (card) =>
      card.fsrs_state.state === FSRSState.Learning ||
      card.fsrs_state.state === FSRSState.Relearning
  );
}

export function getReviewCards(cards: UserFlashcard[]): UserFlashcard[] {
  return cards.filter((card) => card.fsrs_state.state === FSRSState.Review);
}

export function getMatureCards(cards: UserFlashcard[]): UserFlashcard[] {
  return cards.filter(
    (card) =>
      card.fsrs_state.state === FSRSState.Review &&
      card.fsrs_state.stability >= 21
  );
}

export function getCardsForSession(
  cards: UserFlashcard[],
  newLimit: number,
  reviewLimit: number
): UserFlashcard[] {
  // #region agent log
  fetch('http://127.0.0.1:7416/ingest/1edaefa5-f6b3-407e-a724-c5352cdc9880',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'b6417a'},body:JSON.stringify({sessionId:'b6417a',location:'scheduler.ts:158',message:'getCardsForSession called',data:{totalCards:cards.length,newLimit,reviewLimit,now:new Date().toISOString()},timestamp:Date.now(),hypothesisId:'A'})}).catch(()=>{});
  // #endregion
  const dueCards = getDueCards(cards);
  // #region agent log
  fetch('http://127.0.0.1:7416/ingest/1edaefa5-f6b3-407e-a724-c5352cdc9880',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'b6417a'},body:JSON.stringify({sessionId:'b6417a',location:'scheduler.ts:164',message:'getDueCards result',data:{dueCardsCount:dueCards.length,firstDueDue:dueCards[0]?.fsrs_state.due,firstDueState:dueCards[0]?.fsrs_state.state},timestamp:Date.now(),hypothesisId:'A'})}).catch(()=>{});
  // #endregion
  const newCards = getNewCards(cards, newLimit);
  // #region agent log
  fetch('http://127.0.0.1:7416/ingest/1edaefa5-f6b3-407e-a724-c5352cdc9880',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'b6417a'},body:JSON.stringify({sessionId:'b6417a',location:'scheduler.ts:169',message:'getNewCards result',data:{newCardsCount:newCards.length},timestamp:Date.now(),hypothesisId:'A'})}).catch(()=>{});
  // #endregion
  
  const reviewCards = dueCards.filter(
    (card) => card.fsrs_state.state !== FSRSState.New
  );
  // #region agent log
  fetch('http://127.0.0.1:7416/ingest/1edaefa5-f6b3-407e-a724-c5352cdc9880',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'b6417a'},body:JSON.stringify({sessionId:'b6417a',location:'scheduler.ts:176',message:'reviewCards filtered',data:{reviewCardsCount:reviewCards.length},timestamp:Date.now(),hypothesisId:'A'})}).catch(()=>{});
  // #endregion
  
  const selectedReviewCards = reviewCards.slice(0, reviewLimit);
  const selectedNewCards = newCards.slice(0, newLimit);
  // #region agent log
  fetch('http://127.0.0.1:7416/ingest/1edaefa5-f6b3-407e-a724-c5352cdc9880',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'b6417a'},body:JSON.stringify({sessionId:'b6417a',location:'scheduler.ts:184',message:'Final selection',data:{selectedReviewCount:selectedReviewCards.length,selectedNewCount:selectedNewCards.length,totalSelected:selectedReviewCards.length+selectedNewCards.length},timestamp:Date.now(),hypothesisId:'A'})}).catch(()=>{});
  // #endregion
  
  return [...selectedReviewCards, ...selectedNewCards];
}

export function calculateRetention(card: FSRSCard, now: Date = new Date()): number {
  const fsrsCard = fsrsCardToCard(card);
  const retrievability = fsrs.get_retrievability(fsrsCard, now);
  return typeof retrievability === 'string' ? parseFloat(retrievability) : retrievability;
}

export function getNextReviewIntervals(card: FSRSCard): {
  again: number;
  hard: number;
  good: number;
  easy: number;
} {
  const fsrsCard = fsrsCardToCard(card);
  const schedulingInfo = fsrs.repeat(fsrsCard, new Date());
  
  return {
    again: schedulingInfo[FSRSRating.Again].card.scheduled_days,
    hard: schedulingInfo[FSRSRating.Hard].card.scheduled_days,
    good: schedulingInfo[FSRSRating.Good].card.scheduled_days,
    easy: schedulingInfo[FSRSRating.Easy].card.scheduled_days,
  };
}
