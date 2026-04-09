-- ============================================
-- QalamSpace Flashcard System Schema
-- ============================================

-- Lexical Entries (Global, Read-Only)
-- Stores the canonical lexical database of Quranic words
create table lexical_entries (
  id uuid primary key default gen_random_uuid(),
  word_id text unique not null,
  type text not null check (type in ('VERB', 'NOUN', 'PARTICLE')),
  canonical_form text not null,
  root text,
  lemma text,
  forms jsonb,
  translation text not null,
  arabic_explanation text,
  examples jsonb not null default '[]',
  source text not null,
  frequency int,
  created_at timestamptz not null default now()
);

create index idx_lexical_entries_word_id on lexical_entries(word_id);
create index idx_lexical_entries_type on lexical_entries(type);
create index idx_lexical_entries_root on lexical_entries(root) where root is not null;

-- User Flashcards (Per User)
-- Tracks which words each user is learning and their FSRS state
create table user_flashcards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references players(id) on delete cascade,
  word_id text not null references lexical_entries(word_id) on delete cascade,
  status text not null default 'IN_BANK' check (status in ('IN_BANK', 'KNOWN_NOT_IN_BANK', 'UNKNOWN_SELECTED')),
  fsrs_state jsonb not null,
  created_at timestamptz not null default now(),
  unique(user_id, word_id)
);

create index idx_user_flashcards_user_id on user_flashcards(user_id);
create index idx_user_flashcards_word_id on user_flashcards(word_id);
create index idx_user_flashcards_status on user_flashcards(user_id, status);
-- Index for JSONB queries
create index idx_user_flashcards_fsrs_state on user_flashcards using gin(fsrs_state);

-- Review Log (Per User)
-- Records every review action for analytics and progress tracking
create table review_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references players(id) on delete cascade,
  card_id uuid not null references user_flashcards(id) on delete cascade,
  word_id text not null,
  rating int not null check (rating between 1 and 4),
  timestamp timestamptz not null default now(),
  session_id uuid not null,
  review_duration_ms int,
  state_before int not null check (state_before between 0 and 3),
  state_after int not null check (state_after between 0 and 3)
);

create index idx_review_log_user_id on review_log(user_id);
create index idx_review_log_card_id on review_log(card_id);
create index idx_review_log_session_id on review_log(session_id);
create index idx_review_log_timestamp on review_log(user_id, timestamp desc);
create index idx_review_log_word_id on review_log(user_id, word_id);

-- User Preferences (Per User)
-- Stores user-specific settings for the flashcard system
create table user_preferences (
  user_id uuid primary key references players(id) on delete cascade,
  show_arabic_explanation boolean not null default false,
  show_root boolean not null default true,
  show_ayah_examples boolean not null default true,
  include_particles boolean not null default true,
  include_proper_nouns boolean not null default false,
  auto_audio boolean not null default false,
  show_transliteration boolean not null default false,
  daily_new_cards_limit int not null default 20 check (daily_new_cards_limit >= 0 and daily_new_cards_limit <= 100),
  daily_review_cards_limit int not null default 100 check (daily_review_cards_limit >= 0 and daily_review_cards_limit <= 500),
  session_size int not null default 20 check (session_size >= 5 and session_size <= 100),
  normalization_level text not null default 'moderate' check (normalization_level in ('strict', 'moderate', 'broad')),
  updated_at timestamptz not null default now()
);

-- ============================================
-- Row Level Security
-- ============================================

alter table lexical_entries enable row level security;
alter table user_flashcards enable row level security;
alter table review_log enable row level security;
alter table user_preferences enable row level security;

-- Lexical Entries: Read-only for all authenticated users
create policy "lexical_entries_read" on lexical_entries for select using (true);

-- User Flashcards: Users can only read/write their own cards
create policy "user_flashcards_read" on user_flashcards for select using (auth.uid() = user_id);
create policy "user_flashcards_insert" on user_flashcards for insert with check (auth.uid() = user_id);
create policy "user_flashcards_update" on user_flashcards for update using (auth.uid() = user_id);
create policy "user_flashcards_delete" on user_flashcards for delete using (auth.uid() = user_id);

-- Review Log: Users can insert their own reviews and read their own history
create policy "review_log_read" on review_log for select using (auth.uid() = user_id);
create policy "review_log_insert" on review_log for insert with check (auth.uid() = user_id);

-- User Preferences: Users can only read/write their own preferences
create policy "user_preferences_read" on user_preferences for select using (auth.uid() = user_id);
create policy "user_preferences_insert" on user_preferences for insert with check (auth.uid() = user_id);
create policy "user_preferences_update" on user_preferences for update using (auth.uid() = user_id);

-- ============================================
-- Helper Functions
-- ============================================

-- Function to automatically update updated_at timestamp
create or replace function update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- Trigger to update user_preferences.updated_at
create trigger update_user_preferences_updated_at
  before update on user_preferences
  for each row
  execute function update_updated_at_column();
