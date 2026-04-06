export enum CardType {
  VERB = "VERB",
  NOUN = "NOUN",
  PARTICLE = "PARTICLE",
}

export enum WordStatus {
  IN_BANK = "IN_BANK",
  KNOWN_NOT_IN_BANK = "KNOWN_NOT_IN_BANK",
  UNKNOWN_SELECTED = "UNKNOWN_SELECTED",
}

export enum FSRSState {
  New = 0,
  Learning = 1,
  Review = 2,
  Relearning = 3,
}

export enum Rating {
  Again = 1,
  Hard = 2,
  Good = 3,
  Easy = 4,
}

export interface VerbForms {
  past: string;
  present: string;
  imperative: string;
  verbal_noun: string;
}

export interface NounForms {
  singular: string;
  plural: string;
}

export interface ExampleReference {
  surah: number;
  ayah: number;
  position: number;
}

export interface LexicalEntry {
  id: string;
  type: CardType;
  canonical_form: string;
  root?: string;
  lemma?: string;
  forms?: VerbForms | NounForms;
  translation: string;
  alternate_meanings?: string[];
  arabic_explanation?: string;
  examples: ExampleReference[];
  source: string;
  frequency?: number;
}

// ============================================================
// FSRS Card State
// ============================================================

export interface FSRSCard {
  due: Date;
  stability: number;
  difficulty: number;
  elapsed_days: number;
  scheduled_days: number;
  learning_steps: number;  // required by ts-fsrs v5+
  reps: number;
  lapses: number;
  state: FSRSState;
  last_review?: Date;
}

// ============================================================
// SM-2 Card State (SuperMemo 2 legacy algorithm)
// ============================================================

export interface SM2Card {
  interval: number;       // days until next review
  repetitions: number;    // number of successful reviews in a row
  easiness: number;       // easiness factor (EF), default 2.5
  due: Date;              // next review date
  last_review?: Date;
}

// ============================================================
// User Flashcard
// ============================================================

export interface UserFlashcard {
  id: string;
  word_id: string;
  fsrs_state: FSRSCard;
  sm2_state?: SM2Card;    // populated from localStorage when SM-2 mode is active
  created_at: Date;
  status: WordStatus;
}

export interface ReviewLogEntry {
  id: string;
  card_id: string;
  word_id: string;
  rating: Rating;
  timestamp: Date;
  session_id: string;
  review_duration_ms?: number;
  state_before: FSRSState;
  state_after: FSRSState;
}

export interface ReviewLogFilters {
  session_id?: string;
  word_id?: string;
  start_date?: Date;
  end_date?: Date;
  rating?: Rating;
}

export interface UserPreferences {
  show_arabic_explanation: boolean;
  show_root: boolean;
  show_ayah_examples: boolean;
  include_particles: boolean;
  include_proper_nouns: boolean;
  auto_audio: boolean;
  show_transliteration: boolean;
  daily_new_cards_limit: number;
  daily_review_cards_limit: number;
  session_size: number;
  normalization_level: "strict" | "moderate" | "broad";
  algorithm: "fsrs" | "sm2";
}

export interface FlashcardSession {
  id: string;
  cards: UserFlashcard[];
  current_index: number;
  start_time: Date;
  end_time?: Date;
  stats: SessionStats;
  algorithm: "fsrs" | "sm2";
}

export interface SessionStats {
  total_cards: number;
  cards_reviewed: number;
  new_cards: number;
  review_cards: number;
  again_count: number;
  hard_count: number;
  good_count: number;
  easy_count: number;
  total_time_ms: number;
}

export interface FSRSParameters {
  request_retention: number;
  maximum_interval: number;
  enable_fuzz: boolean;
  w: number[];
}

export const DEFAULT_FSRS_PARAMETERS: FSRSParameters = {
  request_retention: 0.9,
  maximum_interval: 365,
  enable_fuzz: true,
  w: [
    0.212, 1.2931, 2.3065, 8.2956, 6.4133, 0.8334, 3.0194, 0.001, 1.8722,
    0.1666, 0.796, 1.4835, 0.0614, 0.2629, 1.6483, 0.6014, 1.8729, 0.5425,
    0.0912, 0.0658, 0.1542,
  ],
};

export const DEFAULT_PREFERENCES: UserPreferences = {
  show_arabic_explanation: false,
  show_root: true,
  show_ayah_examples: true,
  include_particles: true,
  include_proper_nouns: false,
  auto_audio: false,
  show_transliteration: false,
  daily_new_cards_limit: 20,
  daily_review_cards_limit: 100,
  session_size: 20,
  normalization_level: "moderate",
  algorithm: "fsrs",
};
