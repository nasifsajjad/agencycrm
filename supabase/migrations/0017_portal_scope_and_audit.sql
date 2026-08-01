-- AgencyOS — Migration 0017: client portal entity scope and transactional audit events.
-- Portal users are authenticated Supabase identities linked to a client contact;
-- they are never treated as workspace members.

create or replace function private.can_access_entity(target_type text, target_id uuid)
returns boolean
language plpgsql
security definer set search_path = public, auth
as $$
declare
  ws uuid;
  entity_client uuid;
  entity_visibility visibility;
begin
  case target_type
    when 'contact' then select workspace_id into ws from public.contacts where id = target_id;
    when 'company' then select workspace_id into ws from public.companies where id = target_id;
    when 'lead' then select workspace_id into ws from public.leads where id = target_id;
    when 'deal' then select workspace_id into ws from public.deals where id = target_id;
    when 'client' then return private.can_access_client(target_id);
    when 'project' then return private.can_access_project(target_id);
    when 'task' then select workspace_id into ws from public.tasks where id = target_id;
    when 'campaign' then select workspace_id into ws from public.campaigns where id = target_id;
    when 'deliverable' then
      select workspace_id, client_id, visibility into ws, entity_client, entity_visibility
      from public.deliverables where id = target_id;
      if ws is null then return false; end if;
      return private.is_workspace_member(ws)
        or (entity_visibility = 'client' and entity_client is not null and private.can_access_client(entity_client));
    when 'approval' then select workspace_id into ws from public.approval_requests where id = target_id;
    when 'time_entry' then select workspace_id into ws from public.time_entries where id = target_id;
    when 'invoice' then select workspace_id into ws from public.invoices where id = target_id;
    else return false;
  end case;
  if ws is null then return false; end if;
  return private.is_workspace_member(ws);
end;
$$;

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
  if not private.can_access_client(portal_row.client_id) then
    raise exception 'Not authorized for this client portal';
  end if;
  if p_title is null or btrim(p_title) = '' then raise exception 'Title is required'; end if;
  insert into public.client_requests (workspace_id, client_id, title, description, priority, status)
  values (portal_row.workspace_id, portal_row.client_id, btrim(p_title), p_description,
    coalesce(nullif(p_priority, ''), 'normal'), 'new')
  returning * into request_row;
  perform private.record_audit(
    portal_row.workspace_id, 'client_request.created', 'client_request', request_row.id,
    null, jsonb_build_object('client_id', portal_row.client_id, 'priority', request_row.priority), null, null
  );
  return request_row;
end;
$$;

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
  if not exists (select 1 from public.approval_steps where approval_request_id = p_approval_id and status = 'pending') then
    update public.approval_requests
    set status = p_decision::approval_status, decided_at = now()
    where id = p_approval_id;
  end if;
  perform private.record_audit(
    p_workspace_id, 'approval.' || p_decision, 'approval', p_approval_id,
    jsonb_build_object('status', approval_row.status),
    jsonb_build_object('status', case when exists (
      select 1 from public.approval_steps where approval_request_id = p_approval_id and status = 'pending'
    ) then 'pending' else p_decision end), null, null
  );
  select * into approval_row from public.approval_requests where id = p_approval_id;
  return approval_row;
end;
$$;

revoke all on function public.create_client_request(text, text, text, text) from public, anon;
grant execute on function public.create_client_request(text, text, text, text) to authenticated;
revoke all on function public.decide_approval(uuid, uuid, uuid, text, text) from public, anon;
grant execute on function public.decide_approval(uuid, uuid, uuid, text, text) to authenticated;
