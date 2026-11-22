-- Durable, server-only maintenance state. First server startup initializes the
-- singleton if absent; subsequent deployments preserve the operator's choice.
create table if not exists public.duel_runtime_settings (
  id smallint primary key check (id = 1),
  maintenance boolean not null
);
alter table public.duel_runtime_settings enable row level security;
revoke all on public.duel_runtime_settings from public,anon,authenticated;
grant select,insert,update on public.duel_runtime_settings to service_role;
