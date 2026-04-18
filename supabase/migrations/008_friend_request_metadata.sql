alter table friends
  add column if not exists requested_by uuid references players(id);

update friends
set requested_by = coalesce(requested_by, player_a)
where requested_by is null;

alter table friends
  alter column requested_by set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'friends_requested_by_member'
  ) then
    alter table friends
      add constraint friends_requested_by_member
      check (requested_by = player_a or requested_by = player_b);
  end if;
end $$;
