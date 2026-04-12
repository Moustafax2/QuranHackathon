alter table room_players
  add column status text not null default 'active'
    check (status in ('active', 'left')),
  add column left_at timestamptz;

create index idx_room_players_active
  on room_players(room_id, joined_at)
  where status = 'active';

update room_players
set status = 'active'
where status is null;

