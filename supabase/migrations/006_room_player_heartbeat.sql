alter table room_players
  add column last_seen_at timestamptz not null default now();

create index idx_room_players_active_last_seen
  on room_players(room_id, last_seen_at)
  where status = 'active';

