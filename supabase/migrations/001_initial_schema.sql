-- ============================================
-- QuranArena Database Schema
-- ============================================

-- Players (linked to quran.com OAuth via sub claim)
create table players (
  id uuid primary key default gen_random_uuid(),
  quran_foundation_uid text unique,
  display_name text not null,
  avatar_url text,
  total_points int not null default 0,
  total_wins int not null default 0,
  created_at timestamptz not null default now()
);

-- Rooms
create table rooms (
  id uuid primary key default gen_random_uuid(),
  code char(6) unique not null,
  host_id uuid not null references players(id),
  game_mode text not null check (game_mode in ('buzzer', 'multiple-choice')),
  status text not null default 'lobby' check (status in ('lobby', 'in_progress', 'finished')),
  settings jsonb not null default '{"num_rounds": 10, "surah_filter": null, "time_per_question": 30}',
  created_at timestamptz not null default now()
);

create index idx_rooms_code on rooms(code);
create index idx_rooms_lobby on rooms(status) where status = 'lobby';

-- Room players (join table)
create table room_players (
  room_id uuid not null references rooms(id) on delete cascade,
  player_id uuid not null references players(id),
  score int not null default 0,
  joined_at timestamptz not null default now(),
  primary key (room_id, player_id)
);

-- Games (one per room session)
create table games (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references rooms(id),
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  total_rounds int not null,
  winner_id uuid references players(id)
);

-- Game rounds (pre-generated questions)
create table game_rounds (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references games(id) on delete cascade,
  round_number int not null,
  prompt_verse_key text not null,
  correct_verse_key text not null,
  prompt_text text,
  correct_text text,
  options jsonb,
  started_at timestamptz,
  ended_at timestamptz
);

-- Round answers
create table round_answers (
  id uuid primary key default gen_random_uuid(),
  round_id uuid not null references game_rounds(id) on delete cascade,
  player_id uuid not null references players(id),
  answer_verse_key text,
  is_correct boolean not null,
  server_received_at timestamptz not null default now(),
  points_awarded int not null default 0,
  unique (round_id, player_id)
);

-- Friends
create table friends (
  player_a uuid not null references players(id),
  player_b uuid not null references players(id),
  status text not null default 'pending' check (status in ('pending', 'accepted')),
  created_at timestamptz not null default now(),
  primary key (player_a, player_b),
  check (player_a < player_b)
);

-- Verse mistakes (track weak spots)
create table verse_mistakes (
  player_id uuid not null references players(id),
  verse_key text not null,
  mistake_count int not null default 1,
  last_mistake_at timestamptz not null default now(),
  primary key (player_id, verse_key)
);

-- ============================================
-- Row Level Security
-- ============================================

alter table players enable row level security;
alter table rooms enable row level security;
alter table room_players enable row level security;
alter table games enable row level security;
alter table game_rounds enable row level security;
alter table round_answers enable row level security;
alter table friends enable row level security;
alter table verse_mistakes enable row level security;

-- Players: anyone can read, only own row can update
create policy "players_read" on players for select using (true);
create policy "players_update" on players for update using (auth.uid() = id);
create policy "players_insert" on players for insert with check (auth.uid() = id);

-- Rooms: anyone can read lobby rooms, participants can read their rooms
create policy "rooms_read" on rooms for select using (true);
create policy "rooms_insert" on rooms for insert with check (auth.uid() = host_id);
create policy "rooms_update" on rooms for update using (auth.uid() = host_id);

-- Room players: read if you're in the room, insert yourself
create policy "room_players_read" on room_players for select using (true);
create policy "room_players_insert" on room_players for insert with check (auth.uid() = player_id);

-- Games: read if you're a participant
create policy "games_read" on games for select using (true);

-- Game rounds: read if game is yours
create policy "game_rounds_read" on game_rounds for select using (true);

-- Round answers: insert own, read all in your game
create policy "round_answers_read" on round_answers for select using (true);
create policy "round_answers_insert" on round_answers for insert with check (auth.uid() = player_id);

-- Friends: read/write own relationships
create policy "friends_read" on friends for select
  using (auth.uid() = player_a or auth.uid() = player_b);
create policy "friends_insert" on friends for insert
  with check (auth.uid() = player_a or auth.uid() = player_b);
create policy "friends_update" on friends for update
  using (auth.uid() = player_a or auth.uid() = player_b);

-- Verse mistakes: own data only
create policy "verse_mistakes_read" on verse_mistakes for select using (auth.uid() = player_id);
create policy "verse_mistakes_insert" on verse_mistakes for insert with check (auth.uid() = player_id);
create policy "verse_mistakes_update" on verse_mistakes for update using (auth.uid() = player_id);
