-- AgencyOS — Migration 0016: adapter transaction boundaries.
-- These functions are deliberately narrow. They are the only supported way
-- for the application adapter to perform the corresponding multi-write
-- workflows; each function authorizes the caller before changing state.

create or replace function public.create_invitation(
  p_workspace_id uuid,
  p_email_normalized text,
  p_token_hash text,
  p_expires_at timestamptz,
  p_role_id uuid,
  p_team_ids uuid[] default '{}'
)
returns public.invitations
language plpgsql
security definer set search_path = public, private, auth
as $$
declare
  invitation_row public.invitations%rowtype;
  current_user_id uuid := auth.uid();
begin
  if current_user_id is null then raise exception 'Not authenticated'; end if;
  if not private.has_permission(p_workspace_id, 'members.invite') then
    raise exception 'Not authorized to invite members';
  end if;
  if p_email_normalized is null or p_email_normalized = '' or p_token_hash is null or p_expires_at is null then
    raise exception 'Invitation email, token, and expiry are required';
  end if;
  if not exists (select 1 from public.roles r where r.id = p_role_id and r.workspace_id = p_workspace_id) then
    raise exception 'Invitation role does not belong to the workspace';
  end if;
  if exists (
    select 1 from unnest(coalesce(p_team_ids, '{}')) team_id
    where not exists (select 1 from public.teams t where t.id = team_id and t.workspace_id = p_workspace_id)
  ) then
    raise exception 'Invitation team does not belong to the workspace';
  end if;

  insert into public.invitations (workspace_id, email_normalized, token_hash, expires_at, invited_by)
  values (p_workspace_id, lower(trim(p_email_normalized)), p_token_hash, p_expires_at, current_user_id)
  returning * into invitation_row;

  insert into public.invitation_roles (invitation_id, role_id)
  values (invitation_row.id, p_role_id);

  insert into public.invitation_teams (invitation_id, team_id)
  select invitation_row.id, team_id from unnest(coalesce(p_team_ids, '{}')) team_id;

  return invitation_row;
end;
$$;

revoke all on function public.create_invitation(uuid, text, text, timestamptz, uuid, uuid[]) from public, anon;
grant execute on function public.create_invitation(uuid, text, text, timestamptz, uuid, uuid[]) to authenticated;

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
begin
  if current_user_id is null then raise exception 'Not authenticated'; end if;
  if p_decision not in ('approved', 'changes_requested') then raise exception 'Invalid approval decision'; end if;
  select * into approval_row from public.approval_requests where id = p_approval_id and workspace_id = p_workspace_id for update;
  if approval_row.id is null then raise exception 'Approval not found'; end if;
  if not (private.has_permission(p_workspace_id, 'approvals.decide') or private.can_access_entity(approval_row.entity_type, approval_row.entity_id)) then
    raise exception 'Not authorized to decide this approval';
  end if;
  if approval_row.status <> 'pending' then raise exception 'Approval is no longer pending'; end if;
  select * into step_row from public.approval_steps where id = p_step_id and approval_request_id = p_approval_id for update;
  if step_row.id is null or step_row.status <> 'pending' then raise exception 'Approval step is no longer pending'; end if;

  update public.approval_steps
  set status = p_decision, decided_at = now(), decision_note = p_note, decided_by_user_id = current_user_id
  where id = p_step_id;
  insert into public.approval_events (approval_request_id, actor_user_id, action, note)
  values (p_approval_id, current_user_id, p_decision, p_note);
  if not exists (select 1 from public.approval_steps where approval_request_id = p_approval_id and status = 'pending') then
    update public.approval_requests set status = p_decision::approval_status, decided_at = now() where id = p_approval_id;
  end if;
  select * into approval_row from public.approval_requests where id = p_approval_id;
  return approval_row;
end;
$$;

revoke all on function public.decide_approval(uuid, uuid, uuid, text, text) from public, anon;
grant execute on function public.decide_approval(uuid, uuid, uuid, text, text) to authenticated;

create or replace function public.create_client_request(
  p_portal_slug text,
  p_title text,
  p_description text,
  p_priority text
)
returns public.client_requests
language plpgsql
security definer set search_path = public, private, auth
as $$
declare
  portal_row public.client_portals%rowtype;
  request_row public.client_requests%rowtype;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  select * into portal_row from public.client_portals where slug = p_portal_slug;
  if portal_row.id is null then raise exception 'Portal not found'; end if;
  if not (private.is_workspace_member(portal_row.workspace_id) or private.can_access_client(portal_row.client_id)) then
    raise exception 'Not authorized for this client portal';
  end if;
  if p_title is null or btrim(p_title) = '' then raise exception 'Title is required'; end if;
  insert into public.client_requests (workspace_id, client_id, title, description, priority, status)
  values (portal_row.workspace_id, portal_row.client_id, btrim(p_title), p_description, coalesce(p_priority, 'normal'), 'new')
  returning * into request_row;
  return request_row;
end;
$$;

revoke all on function public.create_client_request(text, text, text, text) from public, anon;
grant execute on function public.create_client_request(text, text, text, text) to authenticated;

create or replace function public.enqueue_outbox_event(
  p_workspace_id uuid,
  p_event_type text,
  p_entity_type text,
  p_entity_id uuid,
  p_actor_user_id uuid,
  p_payload jsonb
)
returns uuid
language plpgsql
security definer set search_path = public, private, auth
as $$
declare event_id uuid;
begin
  if auth.uid() is null or not private.is_workspace_member(p_workspace_id) then
    raise exception 'Not authorized for this workspace';
  end if;
  if p_actor_user_id is not null and p_actor_user_id <> auth.uid() then
    raise exception 'Outbox actor must be the authenticated user';
  end if;
  insert into public.outbox_events (workspace_id, event_type, entity_type, entity_id, actor_user_id, payload)
  values (p_workspace_id, p_event_type, p_entity_type, p_entity_id, p_actor_user_id, coalesce(p_payload, '{}'::jsonb))
  returning id into event_id;
  return event_id;
end;
$$;

revoke all on function public.enqueue_outbox_event(uuid, text, text, uuid, uuid, jsonb) from public, anon;
grant execute on function public.enqueue_outbox_event(uuid, text, text, uuid, uuid, jsonb) to authenticated;
