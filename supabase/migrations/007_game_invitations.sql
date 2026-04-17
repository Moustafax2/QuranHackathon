create table if not exists game_invitations (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references rooms(id) on delete cascade,
  inviter_player_id uuid not null references players(id) on delete cascade,
  invitee_qf_user_id text not null,
  invitee_display_name text not null,
  invitee_username text,
  invitee_avatar_url text,
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'declined', 'revoked')),
  created_at timestamptz not null default now(),
  responded_at timestamptz
);

create unique index if not exists idx_game_invitations_room_invitee
  on game_invitations(room_id, invitee_qf_user_id);

create index if not exists idx_game_invitations_invitee_qf_user_id
  on game_invitations(invitee_qf_user_id);

create index if not exists idx_game_invitations_inviter_player_id
  on game_invitations(inviter_player_id);

alter table game_invitations enable row level security;
