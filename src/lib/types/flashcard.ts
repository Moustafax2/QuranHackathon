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
  imperative?: string;
  verbal_noun?: string;
}

export interface NounForms {
  singular: string;
  plural?: string;
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
  arabic_explanation?: string;
  examples: ExampleReference[];
  source: string;
  frequency?: number;
}

export interface FSRSCard {
  due: Date;
  stability: number;
  difficulty: number;
  elapsed_days: number;
  scheduled_days: number;
  reps: number;
  lapses: number;
  state: FSRSState;
  last_review?: Date;
}

export interface UserFlashcard {
  id: string;
  word_id: string;
  fsrs_state: FSRSCard;
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
}

export interface FlashcardSession {
  id: string;
  cards: UserFlashcard[];
  current_index: number;
  start_time: Date;
  end_time?: Date;
  stats: SessionStats;
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
};
