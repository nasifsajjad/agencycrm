-- 0027 — Let users actually request an approval, and stop a rejection being
--        overwritten by a later approval.
--
-- A. Nothing could create an approval request.
--
--    The decision flow, the step tracking and the immutable event log all work
--    (0017), and 0025 added the approval_steps INSERT policy. But no code path
--    anywhere creates a request with its approvers — only seed.ts does, for
--    demo data. The approvals list page even says "Approvals are requested from
--    deliverable pages or directly from project work", and no such control
--    exists. The feature was reachable only for records the seeder made.
--
--    Creating a request plus its steps is a multi-write, so per AGENTS.md it
--    belongs in an RPC rather than the PostgREST adapter, which has no
--    transaction.
--
-- B. A rejection could be overwritten by a later approval.
--
--    decide_approval settles the request when no steps remain pending, using
--    whichever decision came last:
--
--      if not exists (... status = 'pending') then
--        update public.approval_requests set status = p_decision::approval_status
--
--    With two approvers, if A requests changes and B then approves, the
--    request ends as 'approved' — the objection silently discarded. For a
--    client-facing approval workflow that is the worst possible direction to
--    fail in. A changes_requested now settles the request immediately.

-- ---------------------------------------------------------------------------
-- A. Creation
-- ---------------------------------------------------------------------------
create or replace function public.create_approval_request(
  p_workspace_id uuid,
  p_entity_type text,
  p_entity_id uuid,
  p_title text,
  p_instructions text default null,
  p_due_at timestamptz default null,
  p_approver_ids uuid[] default '{}'::uuid[]
)
returns public.approval_requests
language plpgsql
security definer set search_path = public, private, auth
as $$
declare
  current_user_id uuid := auth.uid();
  approval_row public.approval_requests%rowtype;
  approver uuid;
  next_position integer := 0;
  distinct_approvers uuid[];
begin
  if current_user_id is null then raise exception 'Not authenticated'; end if;

  -- Re-checked here rather than trusting the caller, because this function is
  -- SECURITY DEFINER and therefore runs outside RLS.
  if not private.has_permission(p_workspace_id, 'approvals.request') then
    raise exception 'Not authorized to request approvals';
  end if;

  if coalesce(btrim(p_title), '') = '' then
    raise exception 'An approval request needs a title';
  end if;

  if p_entity_type is null or p_entity_id is null then
    raise exception 'An approval request must reference a record';
  end if;

  -- The requester must be able to see the record they are routing for review,
  -- or an approval request becomes a way to probe for record existence across
  -- a workspace.
  if not private.can_access_entity(p_entity_type, p_entity_id) then
    raise exception 'Not authorized to request approval for this record';
  end if;

  select array_agg(distinct approver_id) into distinct_approvers
  from unnest(p_approver_ids) as approver_id
  where approver_id is not null;

  if distinct_approvers is null or array_length(distinct_approvers, 1) is null then
    raise exception 'An approval request needs at least one approver';
  end if;

  -- Every approver must be an active member of this workspace. Without this,
  -- a caller could name any user id and create a step naming someone outside
  -- the tenant.
  if exists (
    select 1 from unnest(distinct_approvers) as approver_id
    where not exists (
      select 1 from public.workspace_memberships m
      where m.workspace_id = p_workspace_id
        and m.user_id = approver_id
        and m.status = 'active'
    )
  ) then
    raise exception 'Every approver must be an active member of this workspace';
  end if;

  insert into public.approval_requests (
    workspace_id, entity_type, entity_id, title, instructions, status, due_at, requested_by
  ) values (
    p_workspace_id, p_entity_type, p_entity_id, btrim(p_title),
    nullif(btrim(p_instructions), ''), 'pending', p_due_at, current_user_id
  )
  returning * into approval_row;

  foreach approver in array distinct_approvers loop
    insert into public.approval_steps (
      approval_request_id, position, approver_type, approver_id, status
    ) values (
      approval_row.id, next_position, 'user', approver, 'pending'
    );
    next_position := next_position + 1;
  end loop;

  insert into public.approval_events (approval_request_id, actor_user_id, action, note)
  values (approval_row.id, current_user_id, 'requested', nullif(btrim(p_instructions), ''));

  perform private.record_audit(
    p_workspace_id, 'approval.requested', 'approval', approval_row.id,
    null,
    jsonb_build_object(
      'title', approval_row.title,
      'entity_type', p_entity_type,
      'entity_id', p_entity_id,
      'approver_count', array_length(distinct_approvers, 1)
    ),
    null, null
  );

  return approval_row;
end;
$$;

revoke all on function public.create_approval_request(uuid, text, uuid, text, text, timestamptz, uuid[])
  from public, anon;
grant execute on function public.create_approval_request(uuid, text, uuid, text, text, timestamptz, uuid[])
  to authenticated;

comment on function public.create_approval_request(uuid, text, uuid, text, text, timestamptz, uuid[]) is
  'Atomically creates an approval request and one pending step per approver. Requires approvals.request in the workspace and access to the referenced record; every approver must be an active member.';

-- ---------------------------------------------------------------------------
-- B. Decision settlement
--
-- Replaces 0017's version. The only behavioural change is the settlement rule:
-- changes_requested ends the request immediately instead of waiting for the
-- remaining approvers and then being overwritten by whoever answered last.
-- ---------------------------------------------------------------------------
create or replace function public.decide_approval(
  p_workspace_id uuid,
  p_approval_id uuid,
  p_step_id uuid,
  p_decision text,
  p_note text
)
returns public.approval_requests
language plpgsql
security definer set search_path = public, private, auth
as $$
declare
  approval_row public.approval_requests%rowtype;
  step_row public.approval_steps%rowtype;
  current_user_id uuid := auth.uid();
  settled_status approval_status;
begin
  if current_user_id is null then raise exception 'Not authenticated'; end if;
  if p_decision not in ('approved', 'changes_requested') then raise exception 'Invalid approval decision'; end if;

  select * into approval_row from public.approval_requests
  where id = p_approval_id and workspace_id = p_workspace_id for update;
  if approval_row.id is null then raise exception 'Approval not found'; end if;

  if not (private.has_permission(p_workspace_id, 'approvals.decide')
    or private.can_access_entity(approval_row.entity_type, approval_row.entity_id)) then
    raise exception 'Not authorized to decide this approval';
  end if;
  if approval_row.status <> 'pending' then raise exception 'Approval is no longer pending'; end if;

  select * into step_row from public.approval_steps
  where id = p_step_id and approval_request_id = p_approval_id for update;
  if step_row.id is null or step_row.status <> 'pending' then raise exception 'Approval step is no longer pending'; end if;

  update public.approval_steps
  set status = p_decision, decided_at = now(), decision_note = p_note, decided_by_user_id = current_user_id
  where id = p_step_id;

  insert into public.approval_events (approval_request_id, actor_user_id, action, note)
  values (p_approval_id, current_user_id, p_decision, p_note);

  -- A request for changes settles the request on its own: the work has to go
  -- back regardless of what the remaining approvers would have said. Approval
  -- still requires every step to have answered.
  if p_decision = 'changes_requested' then
    settled_status := 'changes_requested';
  elsif not exists (
    select 1 from public.approval_steps
    where approval_request_id = p_approval_id and status = 'pending'
  ) then
    settled_status := 'approved';
  else
    settled_status := null;
  end if;

  if settled_status is not null then
    update public.approval_requests
    set status = settled_status, decided_at = now()
    where id = p_approval_id;
  end if;

  perform private.record_audit(
    p_workspace_id, 'approval.' || p_decision, 'approval', p_approval_id,
    jsonb_build_object('status', approval_row.status),
    jsonb_build_object('status', coalesce(settled_status::text, 'pending')),
    null, null
  );

  select * into approval_row from public.approval_requests where id = p_approval_id;
  return approval_row;
end;
$$;

revoke all on function public.decide_approval(uuid, uuid, uuid, text, text) from public, anon;
grant execute on function public.decide_approval(uuid, uuid, uuid, text, text) to authenticated;

comment on function public.decide_approval(uuid, uuid, uuid, text, text) is
  'Records one approver decision. Approval requires every step to approve; a single changes_requested settles the whole request so an objection cannot be overwritten by a later approval.';
