-- Private server-only snapshots. No client endpoint exposes this table.
create table if not exists public.duel_account_rooms (
  code text primary key check (code ~ '^[A-Z2-9]{6}$'),
  snapshot jsonb not null,
  updated_at timestamptz not null default now()
);
alter table public.duel_account_rooms enable row level security;
revoke all on public.duel_account_rooms from public,anon,authenticated;
grant select,insert,update,delete on public.duel_account_rooms to service_role;
