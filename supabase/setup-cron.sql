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
-- EDIT THE TWO VALUES IN THE `settings` BLOCK BELOW BEFORE RUNNING.
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
  -- ======================= EDIT THESE TWO =======================
  app_url    text := 'https://YOUR-APP.vercel.app';   -- no trailing slash
  cron_secret text := 'PASTE_THE_SAME_CRON_SECRET_YOU_SET_IN_VERCEL';
  -- ==============================================================
begin
  if app_url like '%YOUR-APP%' or cron_secret like 'PASTE%' then
    raise exception 'Edit app_url and cron_secret at the top of this block first';
  end if;

  -- Replace on re-run so rotating the secret is just re-running this file.
  perform vault.create_secret(app_url, 'agencyos_app_url', 'AgencyOS deployed app origin')
  where not exists (select 1 from vault.secrets where name = 'agencyos_app_url');

  perform vault.create_secret(cron_secret, 'agencyos_cron_secret', 'Bearer token for /api/cron/process-outbox')
  where not exists (select 1 from vault.secrets where name = 'agencyos_cron_secret');

  update vault.secrets set secret = app_url where name = 'agencyos_app_url';
  update vault.secrets set secret = cron_secret where name = 'agencyos_cron_secret';
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
