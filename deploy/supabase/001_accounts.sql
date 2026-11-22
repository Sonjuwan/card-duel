-- Apply in Supabase SQL editor as project owner. No access from anon/authenticated.
create table if not exists public.duel_accounts (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  role text not null default 'player' check (role in ('player','developer')),
  profile jsonb not null,
  revision bigint not null default 0 check (revision >= 0)
);
create table if not exists public.duel_sessions (
  token_hash text primary key check (token_hash ~ '^[0-9a-f]{64}$'),
  account_id uuid not null references public.duel_accounts(id) on delete cascade,
  expires_at timestamptz not null
);
create index if not exists duel_sessions_expiry on public.duel_sessions(expires_at);
alter table public.duel_accounts enable row level security;
alter table public.duel_sessions enable row level security;
revoke all on public.duel_accounts, public.duel_sessions from public, anon, authenticated;
grant select, insert, update, delete on public.duel_accounts, public.duel_sessions to service_role;
