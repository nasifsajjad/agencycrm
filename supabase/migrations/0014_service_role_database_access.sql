-- The Supabase service role intentionally bypasses RLS for trusted server
-- workers only. It still needs database grants when PostgREST switches roles.
grant usage on schema public, audit, storage to service_role;
grant all privileges on all tables in schema public, audit, storage to service_role;
grant all privileges on all sequences in schema public, audit, storage to service_role;
