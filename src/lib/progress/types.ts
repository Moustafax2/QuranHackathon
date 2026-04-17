import type { PlayGameMode } from "@/lib/supabase/types";

export type DashboardMode =
  | "multiple-choice"
  | "word-meaning"
  | "fill-in-blank"
  | "trivia"
  | "flashcards"
  | "memorization-tester";

export type ProgressSource = "synced" | "local";
export type SourceState = "synced" | "local" | "mixed" | "unavailable";
export type CoverageDimension = "juz" | "surah" | "page";

export interface PlayerLifetimeSummary {
  id: string;
  display_name: string;
  total_points: number;
  total_wins: number;
  created_at: string;
}

export interface PlayProgressEvent {
  id: string;
  mode: PlayGameMode;
  correct: boolean;
  points_awarded: number;
  tested_at: string;
  prompt_verse_key: string | null;
  prompt_surah_id: number | null;
  prompt_juz_number: number | null;
  prompt_page_number: number | null;
}

export interface VerseHotspot {
  verse_key: string;
  mistake_count: number;
  last_mistake_at: string;
}

export interface PlayProgressResponse {
  player: PlayerLifetimeSummary | null;
  events: PlayProgressEvent[];
  hotspots: VerseHotspot[];
}

export interface ProgressEvent {
  id: string;
  mode: DashboardMode;
  source: ProgressSource;
  timestamp: string;
  score: number;
  success: boolean;
  verseKey: string | null;
  surahId: number | null;
  juzNumber: number | null;
  pageNumber: number | null;
  points: number;
}

export interface ModeSummary {
  mode: DashboardMode;
  label: string;
  attempts: number;
  successRate: number | null;
  averageScore: number | null;
  lastActivityAt: string | null;
  totalPoints: number;
  source: SourceState;
}

export interface CoverageBucket {
  dimension: CoverageDimension;
  id: number;
  label: string;
  attempts: number;
  successRate: number;
  averageScore: number;
  lastActivityAt: string | null;
  modes: DashboardMode[];
}

export interface CoverageBucketModeBreakdown {
  mode: DashboardMode;
  label: string;
  attempts: number;
  successRate: number;
  averageScore: number;
  lastActivityAt: string | null;
}

export interface CoverageBucketDetails {
  bucket: CoverageBucket;
  events: ProgressEvent[];
  modeBreakdown: CoverageBucketModeBreakdown[];
}

export interface Recommendation {
  id: string;
  title: string;
  description: string;
  href?: string;
  ctaLabel?: string;
}

export interface DashboardOverview {
  totalAttempts: number;
  successRate: number | null;
  averageScore: number | null;
  streakDays: number;
  activeDays: number;
  strongestMode: DashboardMode | null;
  weakestMode: DashboardMode | null;
}

export interface FlashcardProgressSummary {
  totalCards: number;
  dueCount: number;
  newCount: number;
  reviews: number;
  retentionRate: number | null;
  matureCards: number;
  learningCards: number;
  source: SourceState;
}

export interface DashboardSources {
  overall: SourceState;
  play: SourceState;
  flashcards: SourceState;
  memorization: SourceState;
}

export interface ProgressDashboard {
  overview: DashboardOverview;
  sources: DashboardSources;
  modeSummaries: ModeSummary[];
  events: ProgressEvent[];
  coverage: Record<CoverageDimension, CoverageBucket[]>;
  insights: Recommendation[];
  hotspots: VerseHotspot[];
  flashcards: FlashcardProgressSummary;
  player: PlayerLifetimeSummary | null;
}
