alter table rooms
  drop constraint if exists rooms_game_mode_check;

alter table rooms
  add constraint rooms_game_mode_check
  check (game_mode in ('multiple-choice', 'word-meaning', 'fill-in-blank', 'trivia', 'buzzer'));

alter table game_rounds
  add column if not exists game_mode text
    check (game_mode in ('multiple-choice', 'word-meaning', 'fill-in-blank', 'trivia', 'buzzer')),
  add column if not exists prompt_surah_id int,
  add column if not exists prompt_juz_number int,
  add column if not exists prompt_page_number int;

create index if not exists idx_game_rounds_game_mode on game_rounds(game_mode);
create index if not exists idx_game_rounds_prompt_surah_id
  on game_rounds(prompt_surah_id)
  where prompt_surah_id is not null;
create index if not exists idx_game_rounds_prompt_juz_number
  on game_rounds(prompt_juz_number)
  where prompt_juz_number is not null;
create index if not exists idx_game_rounds_prompt_page_number
  on game_rounds(prompt_page_number)
  where prompt_page_number is not null;

alter table user_flashcards
  add column if not exists source_surah_id int,
  add column if not exists source_ayah_number int,
  add column if not exists source_juz_number int,
  add column if not exists source_page_number int;

create index if not exists idx_user_flashcards_source_surah
  on user_flashcards(user_id, source_surah_id)
  where source_surah_id is not null;
create index if not exists idx_user_flashcards_source_juz
  on user_flashcards(user_id, source_juz_number)
  where source_juz_number is not null;
create index if not exists idx_user_flashcards_source_page
  on user_flashcards(user_id, source_page_number)
  where source_page_number is not null;

create table if not exists memorization_attempts (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references players(id) on delete cascade,
  client_attempt_id text not null,
  mode text not null check (mode in ('ayah', 'page-blank')),
  rating_level int not null check (rating_level between 0 and 2),
  verse_key text,
  surah_id int,
  ayah_number int,
  juz_number int,
  page_number int,
  selection_type text check (selection_type in ('juz', 'surah')),
  cover_region text check (cover_region in ('top', 'middle', 'bottom')),
  tested_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (player_id, client_attempt_id)
);

create index if not exists idx_memorization_attempts_player_tested_at
  on memorization_attempts(player_id, tested_at desc);
create index if not exists idx_memorization_attempts_player_surah
  on memorization_attempts(player_id, surah_id)
  where surah_id is not null;
create index if not exists idx_memorization_attempts_player_juz
  on memorization_attempts(player_id, juz_number)
  where juz_number is not null;
create index if not exists idx_memorization_attempts_player_page
  on memorization_attempts(player_id, page_number)
  where page_number is not null;
create index if not exists idx_memorization_attempts_player_mode
  on memorization_attempts(player_id, mode);

alter table memorization_attempts enable row level security;

create policy "memorization_attempts_read" on memorization_attempts
  for select using (auth.uid() = player_id);

create policy "memorization_attempts_insert" on memorization_attempts
  for insert with check (auth.uid() = player_id);

create policy "memorization_attempts_update" on memorization_attempts
  for update using (auth.uid() = player_id);

create policy "memorization_attempts_delete" on memorization_attempts
  for delete using (auth.uid() = player_id);
