-- AgencyOS — Migration 0018: atomic won-deal to client/onboarding conversion.

alter table public.deals add column if not exists converted_client_id uuid references public.clients(id);
alter table public.deals add column if not exists converted_at timestamptz;
alter table public.deals add column if not exists converted_by uuid references public.profiles(user_id);
create index if not exists deals_converted_client_idx on public.deals(converted_client_id);

create or replace function public.convert_deal_to_client(
  p_workspace_id uuid,
  p_deal_id uuid,
  p_client_name text default null,
  p_client_code text default null
)
returns jsonb
language plpgsql
security definer set search_path = public, private, auth
as $$
declare
  current_user_id uuid := auth.uid();
  deal_row public.deals%rowtype;
  client_row public.clients%rowtype;
  project_row public.projects%rowtype;
  task_row public.tasks%rowtype;
  planning_status uuid;
  todo_status uuid;
  display_name text;
begin
  if current_user_id is null then raise exception 'Not authenticated'; end if;
  if not (private.has_permission(p_workspace_id, 'crm.update') and private.has_permission(p_workspace_id, 'clients.create')) then
    raise exception 'Not authorized to convert deals';
  end if;

  select d.* into deal_row
  from public.deals d
  join public.pipeline_stages s on s.id = d.stage_id
  where d.id = p_deal_id and d.workspace_id = p_workspace_id and s.is_won = true
  for update;
  if deal_row.id is null then raise exception 'Only a won deal in this workspace can be converted'; end if;

  if deal_row.converted_client_id is not null then
    select * into client_row from public.clients where id = deal_row.converted_client_id;
    select * into project_row from public.projects
    where client_id = client_row.id and workspace_id = p_workspace_id
    order by created_at asc limit 1;
    select * into task_row from public.tasks
    where project_id = project_row.id and workspace_id = p_workspace_id
    order by created_at asc limit 1;
    return jsonb_build_object('clientId', client_row.id, 'projectId', project_row.id, 'taskId', task_row.id, 'replayed', true);
  end if;

  display_name := coalesce(nullif(btrim(p_client_name), ''), deal_row.name);
  if deal_row.company_id is not null then
    select * into client_row from public.clients where company_id = deal_row.company_id for update;
  end if;
  if client_row.id is null then
    insert into public.clients (workspace_id, company_id, name, code, status, owner_user_id, onboarding_status)
    values (p_workspace_id, deal_row.company_id, display_name, nullif(btrim(p_client_code), ''), 'active',
      coalesce(deal_row.owner_user_id, current_user_id), 'in_progress')
    returning * into client_row;
  end if;

  select id into planning_status from public.project_statuses
  where workspace_id = p_workspace_id and category = 'planning' order by position asc limit 1;
  insert into public.projects (workspace_id, client_id, name, owner_user_id, status_id, currency, visibility)
  values (p_workspace_id, client_row.id, 'Onboarding: ' || display_name,
    coalesce(deal_row.owner_user_id, current_user_id), planning_status, deal_row.currency, 'internal')
  returning * into project_row;

  select id into todo_status from public.task_statuses
  where workspace_id = p_workspace_id and category = 'todo' order by position asc limit 1;
  insert into public.tasks (workspace_id, project_id, name, owner_user_id, status_id, visibility)
  values (p_workspace_id, project_row.id, 'Kickoff and onboarding',
    coalesce(deal_row.owner_user_id, current_user_id), todo_status, 'internal')
  returning * into task_row;

  update public.deals
  set converted_client_id = client_row.id, converted_at = now(), converted_by = current_user_id
  where id = deal_row.id;

  perform private.record_audit(
    p_workspace_id, 'deal.converted_to_client', 'deal', deal_row.id,
    null, jsonb_build_object('client_id', client_row.id, 'project_id', project_row.id, 'task_id', task_row.id), null, null
  );
  return jsonb_build_object('clientId', client_row.id, 'projectId', project_row.id, 'taskId', task_row.id, 'replayed', false);
end;
$$;

revoke all on function public.convert_deal_to_client(uuid, uuid, text, text) from public, anon;
grant execute on function public.convert_deal_to_client(uuid, uuid, text, text) to authenticated;
