-- After 005: also verify the effective secret-key role and RLS bypass.
-- Replace the same read-only function without changing player rows or grants
-- to any additional role. Re-applying is safe; no data changes.
begin;
create or replace function public.duel_schema_readiness()
returns table (
  schema_version integer,
  ranked_match_rpc boolean,
  server_privileges boolean,
  private_access boolean,
  rls_enabled boolean
) language sql stable security invoker set search_path = '' as $$
  with tables(relation) as (values
    ('public.duel_accounts'), ('public.duel_sessions'),
    ('public.duel_ranked_matches'), ('public.duel_account_rooms'),
    ('public.duel_runtime_settings')
  ), required(relation, privilege) as (values
    ('public.duel_accounts','SELECT'), ('public.duel_accounts','INSERT'), ('public.duel_accounts','UPDATE'),
    ('public.duel_sessions','SELECT'), ('public.duel_sessions','INSERT'), ('public.duel_sessions','DELETE'),
    ('public.duel_ranked_matches','SELECT'), ('public.duel_ranked_matches','INSERT'),
    ('public.duel_account_rooms','SELECT'), ('public.duel_account_rooms','INSERT'), ('public.duel_account_rooms','UPDATE'), ('public.duel_account_rooms','DELETE'),
    ('public.duel_runtime_settings','SELECT'), ('public.duel_runtime_settings','INSERT'), ('public.duel_runtime_settings','UPDATE')
  ), untrusted(role_name) as (values ('anon'), ('authenticated')),
  table_privileges(privilege) as (values ('SELECT'), ('INSERT'), ('UPDATE'), ('DELETE'), ('TRUNCATE')),
  column_privileges(privilege) as (values ('SELECT'), ('INSERT'), ('UPDATE')),
  match_rpc(oid) as (
    select pg_catalog.to_regprocedure('public.duel_record_match(uuid,uuid,text,bigint,jsonb)')::oid
  )
  select 6,
    coalesce((
      select not p.prosecdef and p.provolatile='v'
        and pg_catalog.has_function_privilege(current_user,p.oid,'EXECUTE')
      from pg_catalog.pg_proc p join match_rpc r on r.oid=p.oid
    ),false),
    current_user = 'service_role'::name
    and exists (
      select 1 from pg_catalog.pg_roles r where r.rolname=current_user and r.rolbypassrls
    ) and not exists (
      select 1 from tables t
      where coalesce(pg_catalog.row_security_active(pg_catalog.to_regclass(t.relation)::oid),true)
    ) and not exists (
      select 1 from required q
      where not coalesce(pg_catalog.has_table_privilege(current_user,pg_catalog.to_regclass(q.relation)::oid,q.privilege),false)
    ),
    not exists (
      select 1 from tables t cross join untrusted u cross join table_privileges p
      where coalesce(pg_catalog.has_table_privilege(u.role_name::name,pg_catalog.to_regclass(t.relation)::oid,p.privilege),true)
    ) and not exists (
      select 1 from tables t cross join untrusted u cross join column_privileges p
      where coalesce(pg_catalog.has_any_column_privilege(u.role_name::name,pg_catalog.to_regclass(t.relation)::oid,p.privilege),true)
    ) and not exists (
      select 1 from match_rpc r cross join untrusted u
      where coalesce(pg_catalog.has_function_privilege(u.role_name::name,r.oid,'EXECUTE'),true)
    ) and not exists (
      select 1 from untrusted u
      where coalesce(pg_catalog.has_function_privilege(u.role_name::name,pg_catalog.to_regprocedure('public.duel_schema_readiness()')::oid,'EXECUTE'),true)
    ),
    not exists (
      select 1 from tables t
      where not coalesce((
        select c.relrowsecurity from pg_catalog.pg_class c where c.oid=pg_catalog.to_regclass(t.relation)::oid
      ),false)
    );
$$;
revoke all on function public.duel_schema_readiness() from public,anon,authenticated;
grant execute on function public.duel_schema_readiness() to service_role;
notify pgrst, 'reload schema';
commit;
