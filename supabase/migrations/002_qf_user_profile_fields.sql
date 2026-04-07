alter table players
  add column if not exists qf_email text,
  add column if not exists last_login_at timestamptz not null default now();

create index if not exists idx_players_qf_email on players(qf_email);
