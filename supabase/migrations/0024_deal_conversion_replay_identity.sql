-- 0024 — Make deal conversion replay return the records it actually created.
--
-- Problem
-- -------
-- 0018 made conversion idempotent by marking the deal with converted_client_id
-- and short-circuiting on retry. The client half of that is exact. The project
-- and task halves were not persisted at all, so the replay branch re-derived
-- them heuristically (0018:42-47):
--
--   select * into project_row from public.projects
--   where client_id = client_row.id and workspace_id = p_workspace_id
--   order by created_at asc limit 1;
--
-- That returns the EARLIEST project for the client, which is only the one this
-- conversion created when the client had no prior projects. Two ordinary
-- situations break it:
--
--   * The client already existed and had projects. 0018:52 deliberately reuses
--     an existing client matched on company_id, so this is the normal path for
--     any established account, not an edge case.
--   * A second deal for the same company is converted later. Both conversions
--     then replay to the same first project, and the second one reports a
--     project it did not create.
--
-- release_behavior.sql did not catch it because its fixture has exactly one
-- company, deal, client and project, so "earliest" and "the one just created"
-- coincide.
--
-- Two further defects in the same function, found while fixing the above:
--
--   * The existing-client lookup (0018:52) filters only on company_id, with no
--     workspace_id predicate. The function is SECURITY DEFINER, so RLS does not
--     constrain it. Company ids are workspace-scoped in practice, which is the
--     only reason this has not crossed a tenant boundary; it should not depend
--     on that.
--   * The same lookup has no LIMIT. `SELECT INTO` in PL/pgSQL takes an
--     arbitrary row rather than raising when several match, so which client a
--     conversion reuses was unordered.

-- ---------------------------------------------------------------------------
-- Persist the full conversion result.
-- ---------------------------------------------------------------------------
alter table public.deals add column if not exists converted_project_id uuid references public.projects(id);
alter table public.deals add column if not exists converted_task_id uuid references public.tasks(id);

-- Backfill for deals converted before this migration. The heuristic below is
-- the same one the old replay branch applied at read time, so this records
-- what those deals already reported and changes no observable answer. It is
-- applied once here rather than being recomputed on every replay.
update public.deals d
set converted_project_id = (
  select pr.id from public.projects pr
  where pr.client_id = d.converted_client_id
    and pr.workspace_id = d.workspace_id
  order by pr.created_at asc
  limit 1
)
where d.converted_client_id is not null
  and d.converted_project_id is null;

update public.deals d
set converted_task_id = (
  select tk.id from public.tasks tk
  where tk.project_id = d.converted_project_id
    and tk.workspace_id = d.workspace_id
  order by tk.created_at asc
  limit 1
)
where d.converted_project_id is not null
  and d.converted_task_id is null;

create index if not exists deals_converted_project_idx on public.deals(converted_project_id);

-- ---------------------------------------------------------------------------
-- Replace the function.
-- ---------------------------------------------------------------------------
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

  -- Replay: return exactly what this conversion created, read back by id.
  if deal_row.converted_client_id is not null then
    select * into client_row from public.clients
    where id = deal_row.converted_client_id and workspace_id = p_workspace_id;

    if deal_row.converted_project_id is not null then
      select * into project_row from public.projects
      where id = deal_row.converted_project_id and workspace_id = p_workspace_id;
    end if;

    if deal_row.converted_task_id is not null then
      select * into task_row from public.tasks
      where id = deal_row.converted_task_id and workspace_id = p_workspace_id;
    end if;

    return jsonb_build_object(
      'clientId', client_row.id,
      'projectId', project_row.id,
      'taskId', task_row.id,
      'replayed', true
    );
  end if;

  display_name := coalesce(nullif(btrim(p_client_name), ''), deal_row.name);

  -- Reuse an existing client for the same company, scoped to this workspace and
  -- deterministically ordered.
  if deal_row.company_id is not null then
    select * into client_row from public.clients
    where company_id = deal_row.company_id
      and workspace_id = p_workspace_id
    order by created_at asc
    limit 1
    for update;
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

  -- Record all three ids, not just the client, so replay is exact.
  update public.deals
  set converted_client_id = client_row.id,
      converted_project_id = project_row.id,
      converted_task_id = task_row.id,
      converted_at = now(),
      converted_by = current_user_id
  where id = deal_row.id;

  perform private.record_audit(
    p_workspace_id, 'deal.converted_to_client', 'deal', deal_row.id,
    null, jsonb_build_object('client_id', client_row.id, 'project_id', project_row.id, 'task_id', task_row.id), null, null
  );

  return jsonb_build_object(
    'clientId', client_row.id,
    'projectId', project_row.id,
    'taskId', task_row.id,
    'replayed', false
  );
end;
$$;

revoke all on function public.convert_deal_to_client(uuid, uuid, text, text) from public, anon;
grant execute on function public.convert_deal_to_client(uuid, uuid, text, text) to authenticated;

comment on function public.convert_deal_to_client(uuid, uuid, text, text) is
  'Atomically converts a won deal into a client, onboarding project and kickoff task. Idempotent: a retry replays the recorded converted_client_id / converted_project_id / converted_task_id rather than re-deriving them.';
