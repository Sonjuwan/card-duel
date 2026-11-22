create table if not exists public.duel_ranked_matches (
  account_id uuid not null references public.duel_accounts(id) on delete cascade,
  match_id uuid not null,
  outcome text not null check (outcome in ('win','loss','draw')),
  recorded_at timestamptz not null default now(),
  primary key (account_id,match_id)
);
alter table public.duel_ranked_matches enable row level security;
revoke all on public.duel_ranked_matches from public, anon, authenticated;
grant select,insert,update,delete on public.duel_ranked_matches to service_role;

-- Server supplies the result calculated from an authoritative room. Lock profile and
-- atomically record match + new progress; a retry cannot issue a second XP award.
create or replace function public.duel_record_match(p_account uuid,p_match uuid,p_outcome text,p_revision bigint,p_profile jsonb)
returns setof public.duel_accounts language plpgsql security invoker set search_path = '' as $$
declare current_revision bigint;
begin
  select revision into current_revision from public.duel_accounts where id=p_account for update;
  if not found then return; end if;
  if exists(select 1 from public.duel_ranked_matches where account_id=p_account and match_id=p_match) then
    return query select * from public.duel_accounts where id=p_account; return;
  end if;
  if current_revision<>p_revision then return; end if;
  insert into public.duel_ranked_matches(account_id,match_id,outcome) values(p_account,p_match,p_outcome);
  return query update public.duel_accounts set profile=p_profile,revision=revision+1 where id=p_account returning *;
end;
$$;
revoke all on function public.duel_record_match(uuid,uuid,text,bigint,jsonb) from public,anon,authenticated;
grant execute on function public.duel_record_match(uuid,uuid,text,bigint,jsonb) to service_role;
