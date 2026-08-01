-- 0023 — Complete the outbox lifecycle.
--
-- 0020 implemented the claim half of a competing-consumer queue and stopped.
-- Four defects followed from that, all of them silent.
--
-- 1. Stranded events. claim_outbox_events selects `locked_at is null`, and the
--    only things that clear locked_at live in the application's per-event
--    try/catch. If the worker process dies between claiming a batch and
--    finishing it — OOM, deploy, request timeout, host restart — those rows
--    keep locked_at set forever. They are never retried, never dead-lettered,
--    and never appear in any failure count. They simply stop existing as far
--    as the queue is concerned.
--
-- 2. Poison events retry forever. `attempts` was only ever incremented by the
--    application's failure handler. An event that crashes the process rather
--    than throwing never reaches that handler, so its attempt count stays at
--    zero and it is re-claimed indefinitely once (1) is fixed.
--
-- 3. Dead-lettering was indistinguishable from success. On the fifth failure
--    the application set processed_at = now(), the same field it sets after a
--    successful run. A permanently failed event therefore looked processed,
--    and the error that killed it was never persisted anywhere.
--
-- 4. The role guard did not work. `current_user` inside a SECURITY DEFINER
--    function evaluates to the function owner, not the caller, so the
--    `current_user not in ('service_role','postgres')` check could never fire.
--    It was harmless because the GRANT already restricted execution, but it
--    read as a control that was not one. Removed rather than left to mislead.
--
-- The lifecycle now lives in SQL so that each transition is a single atomic
-- statement, rather than a read-modify-write split across the worker.

-- ---------------------------------------------------------------------------
-- Terminal failure state and the error that caused it.
-- ---------------------------------------------------------------------------
alter table public.outbox_events add column if not exists dead_lettered_at timestamptz;
alter table public.outbox_events add column if not exists last_error text;

-- Supports the claim predicate below, including the stale-lock reclaim.
drop index if exists outbox_claimable_idx;
create index if not exists outbox_claimable_idx
  on public.outbox_events (next_attempt_at, locked_at)
  where processed_at is null and dead_lettered_at is null;

-- Operator view: what is stuck and why.
create index if not exists outbox_dead_letter_idx
  on public.outbox_events (workspace_id, dead_lettered_at)
  where dead_lettered_at is not null;

-- ---------------------------------------------------------------------------
-- Claim. Reclaims locks older than p_lock_timeout, counts the attempt at claim
-- time, and never returns an event that has already terminated.
-- ---------------------------------------------------------------------------
-- The 0020 function is claim_outbox_events(integer). Adding a second parameter
-- produces a NEW function rather than replacing it, and because the new one
-- defaults its second argument, a one-argument call would then be ambiguous
-- ("function name is not unique") for both SQL callers and PostgREST. Drop the
-- old signature explicitly.
drop function if exists public.claim_outbox_events(integer);

create or replace function public.claim_outbox_events(
  p_limit integer default 50,
  p_lock_timeout interval default interval '10 minutes'
)
returns setof public.outbox_events
language plpgsql
security definer set search_path = public
as $$
begin
  return query
  with candidates as (
    select id from public.outbox_events
    where processed_at is null
      and dead_lettered_at is null
      and next_attempt_at <= now()
      -- Either unclaimed, or claimed by a worker that has since disappeared.
      and (locked_at is null or locked_at < now() - p_lock_timeout)
    order by created_at asc
    limit greatest(1, least(coalesce(p_limit, 50), 100))
    for update skip locked
  )
  update public.outbox_events e
  -- Counting the attempt here, rather than in the failure handler, is what
  -- stops a process-killing event from being retried forever.
  set locked_at = now(),
      attempts = e.attempts + 1
  from candidates c
  where e.id = c.id
  returning e.*;
end;
$$;

revoke all on function public.claim_outbox_events(integer, interval) from public, anon, authenticated;
grant execute on function public.claim_outbox_events(integer, interval) to service_role;

comment on function public.claim_outbox_events(integer, interval) is
  'Claims a batch of outbox events for one worker. Reclaims locks older than p_lock_timeout so a crashed worker does not strand its batch. Increments attempts at claim time.';

-- ---------------------------------------------------------------------------
-- Success.
-- ---------------------------------------------------------------------------
create or replace function public.complete_outbox_event(p_event_id uuid)
returns void
language sql
security definer set search_path = public
as $$
  update public.outbox_events
  set processed_at = now(),
      locked_at = null,
      last_error = null
  where id = p_event_id
    and processed_at is null
    and dead_lettered_at is null;
$$;

revoke all on function public.complete_outbox_event(uuid) from public, anon, authenticated;
grant execute on function public.complete_outbox_event(uuid) to service_role;

-- ---------------------------------------------------------------------------
-- Failure. Decides retry-with-backoff versus dead-letter in one statement,
-- using the attempt count the claim already recorded.
--
-- Returns 'retry', 'dead_letter', or 'missing' so the worker can report
-- honestly instead of inferring.
-- ---------------------------------------------------------------------------
create or replace function public.fail_outbox_event(
  p_event_id uuid,
  p_error text,
  p_max_attempts integer default 5
)
returns text
language plpgsql
security definer set search_path = public
as $$
declare
  v_attempts integer;
  v_backoff_seconds double precision;
begin
  select attempts into v_attempts
  from public.outbox_events
  where id = p_event_id and processed_at is null and dead_lettered_at is null
  for update;

  if v_attempts is null then
    return 'missing';
  end if;

  if v_attempts >= greatest(1, coalesce(p_max_attempts, 5)) then
    update public.outbox_events
    set dead_lettered_at = now(),
        locked_at = null,
        last_error = left(coalesce(p_error, 'unknown error'), 2000)
    where id = p_event_id;
    return 'dead_letter';
  end if;

  -- 60s, 120s, 240s ... capped at one hour.
  v_backoff_seconds := least(60 * power(2, v_attempts), 3600);

  update public.outbox_events
  set locked_at = null,
      last_error = left(coalesce(p_error, 'unknown error'), 2000),
      next_attempt_at = now() + make_interval(secs => v_backoff_seconds)
  where id = p_event_id;

  return 'retry';
end;
$$;

revoke all on function public.fail_outbox_event(uuid, text, integer) from public, anon, authenticated;
grant execute on function public.fail_outbox_event(uuid, text, integer) to service_role;

comment on function public.fail_outbox_event(uuid, text, integer) is
  'Records an outbox failure. Retries with exponential backoff until attempts reaches p_max_attempts, then moves the event to a dead-letter state that is distinct from processed. Returns retry | dead_letter | missing.';

-- ---------------------------------------------------------------------------
-- Anything already marked processed by the old dead-letter path is
-- indistinguishable from a genuine success and is deliberately left alone;
-- this migration does not guess. Events currently holding a stale lock are
-- picked up automatically by the reclaim above.
-- ---------------------------------------------------------------------------
