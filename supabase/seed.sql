-- AgencyOS — Supabase seed (local development only)
-- Loads the fictional Northstar Growth Studio agency for local testing.
-- NEVER run in production. Demo accounts are created with a known password
-- and are explicitly DISABLED in production mode (see src/lib/seed.ts).

-- Note: in local-only mode (no Supabase configured), the equivalent seed is
-- performed by `bun run scripts/seed-demo-user.ts`, which uses the Prisma
-- client. This SQL file is for `supabase db seed` in local Supabase mode.

-- Demo: create auth.users for the 5 demo identities. Password hash is for
-- "demo-pass-12345" — only created when NODE_ENV !== 'production'.
-- (Run only locally via supabase db seed; controlled by SUPABASE_DEMO_SEED env.)

insert into auth.users (id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, role, aud, instance_id, created_at, updated_at)
select
  gen_random_uuid(),
  email,
  crypt(password, gen_salt('bf')),
  now(),
  '{}'::jsonb,
  jsonb_build_object('display_name', display_name),
  'authenticated',
  'authenticated',
  '00000000-0000-0000-0000-000000000000',
  now(),
  now()
from (values
  ('avery@agencyos.dev', 'Avery Chen', 'demo-pass-12345'),
  ('sarah@northstar.demo', 'Sarah Patel', 'demo-pass-12345'),
  ('marcus@northstar.demo', 'Marcus Lee', 'demo-pass-12345'),
  ('jordan@northstar.demo', 'Jordan Kim', 'demo-pass-12345'),
  ('rio@northstar.demo', 'Rio Tanaka', 'demo-pass-12345'),
  ('alex@aurora.demo', 'Alex Morrow', 'demo-pass-12345')
) as t(email, display_name, password)
where current_setting('app.demo_seed', true) = 'on'
on conflict do nothing;

-- The full Northstar demo agency is then seeded by the application bootstrap
-- (see src/lib/workspace.ts + src/lib/seed.ts), invoked from the onboarding
-- "Load demo agency" button.
