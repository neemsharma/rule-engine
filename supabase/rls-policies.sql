-- ---------------------------------------------------------------------------
-- Read-only RLS policies for the BRAHMO demo.
--
-- The app reaches Postgres through PostgREST using the publishable/anon key,
-- which is subject to RLS. The SQL Editor and pgAdmin connect as `postgres`
-- and bypass RLS, so data can look present there and still be invisible to the
-- app -- HTTP 200 with zero rows.
--
-- The app never writes to Supabase, so SELECT is all it needs. `audit_log` is
-- deliberately left with no policy: nothing reads it, so it stays unreadable.
-- ---------------------------------------------------------------------------

-- 1. Diagnostic: which tables have RLS on, and how many policies each has.
select c.relname                          as table_name,
       c.relrowsecurity                   as rls_enabled,
       (select count(*)
          from pg_policies p
         where p.schemaname = 'public'
           and p.tablename  = c.relname)  as policy_count
  from pg_class c
 where c.relnamespace = 'public'::regnamespace
   and c.relkind = 'r'
 order by 1;

-- 2. Grant read access to the roles the publishable key maps to.
do $$
declare t text;
begin
  foreach t in array array['organizations','hierarchy_levels',
                           'knowledge_nodes','edges','users']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists brahmo_public_read on public.%I', t);
    execute format(
      'create policy brahmo_public_read on public.%I for select to anon, authenticated using (true)', t);
  end loop;
end $$;

-- 3. Verify: every table above should now report one policy.
select tablename, policyname, roles, cmd
  from pg_policies
 where schemaname = 'public'
 order by tablename;
