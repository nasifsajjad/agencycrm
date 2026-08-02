-- ===========================================================================
-- AgencyOS — outbox scheduler, run inside Supabase
--
-- Run this in the Supabase SQL Editor AFTER schema-bundle.sql, and AFTER the
-- app is deployed (you need its URL).
--
-- Why this exists: Vercel Cron on the Hobby plan fires at most once per day.
-- The outbox carries invitation emails, notification fan-out and automation
-- runs, so a daily drain makes the product look broken rather than slow.
-- Supabase Cron runs on any plan and is what prd.md specifies anyway
-- (TD-5: "Supabase Cron for recurring work").
--
-- HOW TO RUN
--   1. Edit `app_url` in the first block below. That is the only edit needed.
--   2. Run the whole file in the SQL Editor.
--   3. The last statement prints a generated CRON_SECRET. Copy it into the
--      Vercel app project's environment variables and redeploy.
--
-- Re-running is safe: the app URL is updated in place and the existing secret
-- is reused, so Vercel does not need updating again.
-- ===========================================================================

-- pg_cron schedules the job; pg_net makes the outbound HTTP call. Both are
-- available on all Supabase plans.
create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;

-- ---------------------------------------------------------------------------
-- Store the app URL and cron secret in Vault rather than inline in the job
-- command. cron.job is readable by any role with access to the cron schema, so
-- an inline bearer token would be a credential sitting in a queryable table.
-- ---------------------------------------------------------------------------
do $$
declare
  -- ======================= EDIT THIS ONE =======================
  app_url text := 'https://YOUR-APP.vercel.app';   -- no trailing slash
  -- =============================================================
  --
  -- The cron secret is NOT edited here. It is generated below with
  -- pgcrypto and printed once at the end of this script, so there is exactly
  -- one source of truth and no chance of the value in Vault disagreeing with
  -- the value in Vercel. Copy what it prints into CRON_SECRET on the app
  -- project, then redeploy.
  cron_secret text;
  existing_id uuid;
begin
  if app_url like '%YOUR-APP%' then
    raise exception 'Set app_url at the top of this block to your deployed app origin';
  end if;
  if app_url !~ '^https://[a-zA-Z0-9.-]+$' then
    raise exception
      'app_url must be a bare https origin with no trailing slash or path, got: %', app_url;
  end if;

  -- Reuse the existing secret on a re-run so this file is idempotent and does
  -- not silently invalidate a working deployment.
  select decrypted_secret into cron_secret
  from vault.decrypted_secrets where name = 'agencyos_cron_secret';

  if cron_secret is null then
    -- Two UUIDv4s, hyphens stripped: 64 hex characters, ~244 bits of
    -- randomness. gen_random_uuid() is built into Postgres 13+, so this needs
    -- no extension — pgcrypto's gen_random_bytes lives in `extensions` on some
    -- projects and `public` on others, and guessing wrong fails the script.
    cron_secret :=
      replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
  end if;

  -- vault.secrets cannot be UPDATEd directly — even as postgres, Supabase
  -- denies it ("permission denied for table secrets"). Both writes must go
  -- through the vault API.
  select id into existing_id from vault.secrets where name = 'agencyos_app_url';
  if existing_id is null then
    perform vault.create_secret(app_url, 'agencyos_app_url', 'AgencyOS deployed app origin');
  else
    perform vault.update_secret(existing_id, app_url);
  end if;

  select id into existing_id from vault.secrets where name = 'agencyos_cron_secret';
  if existing_id is null then
    perform vault.create_secret(
      cron_secret, 'agencyos_cron_secret', 'Bearer token for /api/cron/process-outbox'
    );
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- The worker call. Reads both values from Vault at fire time, so rotating a
-- secret does not require rescheduling the job.
-- ---------------------------------------------------------------------------
create or replace function public.drain_outbox()
returns bigint
language plpgsql
security definer
set search_path = public, extensions, vault
as $$
declare
  app_url text;
  cron_secret text;
  request_id bigint;
begin
  select decrypted_secret into app_url from vault.decrypted_secrets where name = 'agencyos_app_url';
  select decrypted_secret into cron_secret from vault.decrypted_secrets where name = 'agencyos_cron_secret';

  if app_url is null or cron_secret is null then
    raise exception 'agencyos_app_url or agencyos_cron_secret is missing from Vault';
  end if;

  select net.http_post(
    url := app_url || '/api/cron/process-outbox',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || cron_secret,
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 55000
  ) into request_id;

  return request_id;
end;
$$;

-- Maintenance only. Never grant this to an application role: it holds the
-- worker credential.
revoke all on function public.drain_outbox() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Schedule. Every two minutes.
--
-- Safe to overlap: claim_outbox_events (migration 0023) locks the rows it
-- hands out with FOR UPDATE SKIP LOCKED, so a slow run cannot be
-- double-processed by the next one.
-- ---------------------------------------------------------------------------
select cron.unschedule('agencyos-drain-outbox')
where exists (select 1 from cron.job where jobname = 'agencyos-drain-outbox');

select cron.schedule('agencyos-drain-outbox', '*/2 * * * *', 'select public.drain_outbox();');

-- ---------------------------------------------------------------------------
-- Retention: purge soft-deleted records older than 90 days (migration 0026),
-- weekly, early Sunday.
-- ---------------------------------------------------------------------------
select cron.unschedule('agencyos-purge-archived')
where exists (select 1 from cron.job where jobname = 'agencyos-purge-archived');

select cron.schedule(
  'agencyos-purge-archived',
  '23 4 * * 0',
  $$select public.purge_archived_records(interval '90 days');$$
);

-- ---------------------------------------------------------------------------
-- Verify
-- ---------------------------------------------------------------------------
select jobname, schedule, active from cron.job where jobname like 'agencyos-%';

-- ---------------------------------------------------------------------------
-- COPY THIS VALUE into CRON_SECRET on the Vercel app project, then redeploy.
--
-- Until Vercel has the identical value, /api/cron/process-outbox answers 503
-- ("CRON_SECRET is not configured") or 401, and nothing in the outbox drains:
-- no invitation emails, no notification fan-out, no automation runs.
--
-- Re-running this file keeps the existing secret, so the value below stays
-- stable and you do not have to update Vercel again.
-- ---------------------------------------------------------------------------
select
  'CRON_SECRET' as set_this_env_var_in_vercel,
  decrypted_secret as value
from vault.decrypted_secrets
where name = 'agencyos_cron_secret';

-- After a few minutes, check the runs and the HTTP responses:
--   select jobname, status, return_message, start_time
--   from cron.job_run_details
--   join cron.job using (jobid)
--   where jobname like 'agencyos-%'
--   order by start_time desc limit 10;
--
--   select id, status_code, content from net._http_response order by created desc limit 5;
--
-- A 200 means the outbox drained. A 401 means the secret in Vault does not
-- match CRON_SECRET in Vercel. A 503 means CRON_SECRET is unset in Vercel.
