-- Track per-game participant activity to support disconnect grace windows.
create table if not exists game_participants (
  game_id uuid not null references games(id) on delete cascade,
  player_id uuid not null references players(id),
  is_active boolean not null default true,
  last_seen_at timestamptz not null default now(),
  became_inactive_at timestamptz,
  joined_game_at timestamptz not null default now(),
  primary key (game_id, player_id)
);

create index if not exists idx_game_participants_game_id on game_participants(game_id);
create index if not exists idx_game_participants_active on game_participants(game_id, is_active);
create index if not exists idx_game_participants_last_seen on game_participants(game_id, last_seen_at);
