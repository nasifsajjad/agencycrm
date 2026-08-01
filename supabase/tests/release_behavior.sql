-- Release behavior checks for atomic conversion, retry idempotency, and
-- suspended-membership denial. Run in a transaction against local Supabase.
\set ON_ERROR_STOP on
begin;

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values
  ('30000000-0000-4000-8000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'release-owner@example.test', 'not-used', now(), '{}', '{}', now(), now()),
  ('40000000-0000-4000-8000-000000000004', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'release-outsider@example.test', 'not-used', now(), '{}', '{}', now(), now());

set local role authenticated;
select set_config('request.jwt.claim.sub', '30000000-0000-4000-8000-000000000003', true);
select public.create_workspace('Conversion Workspace', 'conversion-workspace', 'USD', 'UTC') as workspace_id \gset
select set_config('release.workspace_id', :'workspace_id', true);
insert into public.companies (workspace_id, name, owner_user_id)
values (:'workspace_id', 'Conversion Company', '30000000-0000-4000-8000-000000000003') returning id as company_id \gset
select p.id as pipeline_id from public.pipelines p where p.workspace_id = :'workspace_id' and p.is_default \gset
select s.id as stage_id from public.pipeline_stages s where s.pipeline_id = :'pipeline_id' and s.is_won \gset
insert into public.deals (workspace_id, company_id, pipeline_id, stage_id, name, owner_user_id)
values (:'workspace_id', :'company_id', :'pipeline_id', :'stage_id', 'Won conversion deal', '30000000-0000-4000-8000-000000000003') returning id as deal_id \gset
select set_config('release.deal_id', :'deal_id', true);

select public.convert_deal_to_client(:'workspace_id', :'deal_id', 'Converted Client', 'CONV') as first_conversion \gset
do $$
begin
  if (select count(*) from public.clients where workspace_id = current_setting('release.workspace_id')::uuid) <> 1 then raise exception 'conversion must create one client'; end if;
  if (select count(*) from public.projects where workspace_id = current_setting('release.workspace_id')::uuid) <> 1 then raise exception 'conversion must create one project'; end if;
  if (select count(*) from public.tasks where workspace_id = current_setting('release.workspace_id')::uuid) <> 1 then raise exception 'conversion must create one onboarding task'; end if;
  if (select converted_client_id from public.deals where id = current_setting('release.deal_id')::uuid) is null then raise exception 'deal conversion marker missing'; end if;
end $$;
select public.convert_deal_to_client(:'workspace_id', :'deal_id', 'Ignored Retry Name', null) as retry_conversion \gset
do $$
begin
  if (select count(*) from public.clients where workspace_id = current_setting('release.workspace_id')::uuid) <> 1 then raise exception 'conversion retry duplicated client'; end if;
  if (select count(*) from public.projects where workspace_id = current_setting('release.workspace_id')::uuid) <> 1 then raise exception 'conversion retry duplicated project'; end if;
  if (select count(*) from public.tasks where workspace_id = current_setting('release.workspace_id')::uuid) <> 1 then raise exception 'conversion retry duplicated task'; end if;
end $$;

-- ---------------------------------------------------------------------------
-- Migration 0024: replay must return the records this conversion created.
--
-- The checks above pass under the old heuristic too, because the fixture has
-- exactly one company, deal, client and project — so "earliest project for the
-- client" and "the project this conversion created" coincide. This section
-- breaks that coincidence: a SECOND won deal for the SAME company converts,
-- reuses the existing client (0018:52 matches on company_id), and creates a
-- second project. Replaying either deal must return its own project, not the
-- earliest one.
-- ---------------------------------------------------------------------------
insert into public.deals (workspace_id, company_id, pipeline_id, stage_id, name, owner_user_id)
values (:'workspace_id', :'company_id', :'pipeline_id', :'stage_id', 'Second won deal', '30000000-0000-4000-8000-000000000003')
returning id as second_deal_id \gset
select set_config('release.second_deal_id', :'second_deal_id', true);

select public.convert_deal_to_client(:'workspace_id', :'second_deal_id', null, null) as second_conversion \gset

do $$
declare
  first_replay jsonb;
  second_replay jsonb;
  first_project uuid;
  second_project uuid;
begin
  -- The same client is reused, so there is now one client and two projects.
  if (select count(*) from public.clients where workspace_id = current_setting('release.workspace_id')::uuid) <> 1 then
    raise exception 'second conversion for the same company must reuse the client';
  end if;
  if (select count(*) from public.projects where workspace_id = current_setting('release.workspace_id')::uuid) <> 2 then
    raise exception 'second conversion must create its own onboarding project';
  end if;

  first_replay := public.convert_deal_to_client(
    current_setting('release.workspace_id')::uuid,
    current_setting('release.deal_id')::uuid, null, null);
  second_replay := public.convert_deal_to_client(
    current_setting('release.workspace_id')::uuid,
    current_setting('release.second_deal_id')::uuid, null, null);

  if (first_replay->>'replayed')::boolean is not true then raise exception 'first deal should replay'; end if;
  if (second_replay->>'replayed')::boolean is not true then raise exception 'second deal should replay'; end if;

  first_project := (first_replay->>'projectId')::uuid;
  second_project := (second_replay->>'projectId')::uuid;

  if first_project = second_project then
    raise exception 'both deals replayed to the same project; replay is re-deriving instead of reading the recorded id';
  end if;

  if first_project <> (select converted_project_id from public.deals where id = current_setting('release.deal_id')::uuid) then
    raise exception 'first deal replayed a project it did not create';
  end if;
  if second_project <> (select converted_project_id from public.deals where id = current_setting('release.second_deal_id')::uuid) then
    raise exception 'second deal replayed a project it did not create';
  end if;

  if (first_replay->>'taskId')::uuid = (second_replay->>'taskId')::uuid then
    raise exception 'both deals replayed to the same task';
  end if;

  -- Still no duplicate side effects from the replays themselves.
  if (select count(*) from public.projects where workspace_id = current_setting('release.workspace_id')::uuid) <> 2 then
    raise exception 'replay created an extra project';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Migration 0023: outbox lifecycle.
--
-- The behaviour that matters here is what happens when a worker disappears
-- mid-batch. Before 0023 the claim predicate required `locked_at is null` and
-- only the worker's own try/catch ever cleared it, so a crashed worker's batch
-- was stranded permanently: never retried, never dead-lettered, never counted.
-- ---------------------------------------------------------------------------
reset role;
set local role service_role;

insert into public.outbox_events (id, workspace_id, event_type, entity_type, entity_id, payload)
values (
  '60000000-0000-4000-8000-000000000006',
  current_setting('release.workspace_id')::uuid,
  'deal.won', 'deal', current_setting('release.deal_id')::uuid, '{}'::jsonb
);

-- A worker claims it, then dies. Nothing clears locked_at.
do $$
declare v_claimed integer;
begin
  select count(*) into v_claimed from public.claim_outbox_events(10);
  if v_claimed <> 1 then raise exception 'claim must return the pending event, got %', v_claimed; end if;
  if (select attempts from public.outbox_events where id = '60000000-0000-4000-8000-000000000006') <> 1 then
    raise exception 'claim must count the attempt, so a process-killing event ages instead of retrying forever';
  end if;
end $$;

-- An immediate re-claim must not hand the same event to a second worker.
do $$
begin
  if (select count(*) from public.claim_outbox_events(10)) <> 0 then
    raise exception 'a live lock was handed to a second worker';
  end if;
end $$;

-- Once the lock is older than the timeout, the event must come back.
update public.outbox_events
set locked_at = now() - interval '30 minutes'
where id = '60000000-0000-4000-8000-000000000006';

do $$
begin
  if (select count(*) from public.claim_outbox_events(10, interval '10 minutes')) <> 1 then
    raise exception 'a stale lock was not reclaimed; a crashed worker still strands its batch';
  end if;
end $$;

-- Failure path: retries with backoff, then dead-letters into a state that is
-- distinct from processed. The old code set processed_at on the final failure,
-- making a permanently broken event look successful.
do $$
declare v_outcome text;
begin
  v_outcome := public.fail_outbox_event('60000000-0000-4000-8000-000000000006', 'simulated delivery failure', 5);
  if v_outcome <> 'retry' then raise exception 'second attempt should retry, got %', v_outcome; end if;

  if (select next_attempt_at from public.outbox_events where id = '60000000-0000-4000-8000-000000000006') <= now() then
    raise exception 'retry must be scheduled into the future';
  end if;
  if (select last_error from public.outbox_events where id = '60000000-0000-4000-8000-000000000006') is null then
    raise exception 'the failure message must be persisted, not discarded';
  end if;

  -- Exhaust the remaining attempts.
  update public.outbox_events
  set attempts = 5, next_attempt_at = now()
  where id = '60000000-0000-4000-8000-000000000006';

  v_outcome := public.fail_outbox_event('60000000-0000-4000-8000-000000000006', 'final failure', 5);
  if v_outcome <> 'dead_letter' then raise exception 'attempt 5 of 5 should dead-letter, got %', v_outcome; end if;
end $$;

do $$
begin
  if (select dead_lettered_at from public.outbox_events where id = '60000000-0000-4000-8000-000000000006') is null then
    raise exception 'dead-lettered event has no dead_lettered_at';
  end if;
  if (select processed_at from public.outbox_events where id = '60000000-0000-4000-8000-000000000006') is not null then
    raise exception 'a dead-lettered event must not be indistinguishable from a processed one';
  end if;
  if (select count(*) from public.claim_outbox_events(10)) <> 0 then
    raise exception 'a dead-lettered event was claimed again';
  end if;
end $$;

-- Ordinary users must not be able to drive the queue.
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '40000000-0000-4000-8000-000000000004', true);
do $$
begin
  begin
    perform public.claim_outbox_events(10);
    raise exception 'claim_outbox_events was callable by an authenticated user';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.fail_outbox_event('60000000-0000-4000-8000-000000000006', 'spoofed', 5);
    raise exception 'fail_outbox_event was callable by an authenticated user';
  exception when insufficient_privilege then null;
  end;
end $$;

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '30000000-0000-4000-8000-000000000003', true);

update public.workspace_memberships
set status = 'suspended'
where workspace_id = :'workspace_id' and user_id = '30000000-0000-4000-8000-000000000003';
do $$
begin
  begin
    perform public.convert_deal_to_client(current_setting('release.workspace_id')::uuid, current_setting('release.deal_id')::uuid, null, null);
    raise exception 'suspended owner unexpectedly retained permission';
  exception when raise_exception then
    if position('Not authorized' in sqlerrm) = 0 then raise; end if;
  end;
end $$;

rollback;
