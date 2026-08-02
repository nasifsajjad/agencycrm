-- 0026 — Soft deletion for user-restorable business records.
--
-- prd.md §12 ("Deletion strategy") requires soft deletion for user-restorable
-- business records, hard deletion only through controlled retention or tenant
-- deletion jobs. Today only `companies` and `contacts` carry archived_at, and
-- the one delete action that exists — deleteContactAction — calls a hard
-- DELETE anyway. A mis-click is unrecoverable, and the audit trail records
-- that a row was deleted without preserving what it contained.
--
-- This adds archived_at to the remaining user-facing CRM and delivery records,
-- plus the columns needed to say who archived a row and why.
--
-- Deliberately NOT given archived_at:
--   * approval_requests / approval_steps / approval_events — decisions are
--     immutable history (prd.md FR-10). Superseding one creates a new round.
--   * audit.events — append-only by definition.
--   * outbox_events — lifecycle is processed/dead-lettered, see 0023.
--   * join tables (record_tags, task_dependencies, membership_roles ...) —
--     these are edges, restored implicitly with their endpoints.

-- ---------------------------------------------------------------------------
-- Columns
-- ---------------------------------------------------------------------------
do $$
declare
  target text;
  targets text[] := array[
    'leads', 'deals', 'activities', 'notes',
    'clients', 'projects', 'tasks', 'milestones',
    'campaigns', 'deliverables', 'content_items',
    'client_requests', 'retainers', 'contracts'
  ];
begin
  foreach target in array targets loop
    execute format('alter table public.%I add column if not exists archived_at timestamptz', target);
    execute format('alter table public.%I add column if not exists archived_by uuid references public.profiles(user_id)', target);
  end loop;
end $$;

-- companies and contacts already have archived_at (0003) but not the actor.
alter table public.companies add column if not exists archived_by uuid references public.profiles(user_id);
alter table public.contacts add column if not exists archived_by uuid references public.profiles(user_id);

-- ---------------------------------------------------------------------------
-- Indexes
--
-- Every list query filters `archived_at is null`, so a partial index on the
-- live rows keeps the common path cheap without carrying the archived tail.
-- The trash view needs the opposite, hence the second, much smaller index.
-- ---------------------------------------------------------------------------
do $$
declare
  target text;
  targets text[] := array[
    'companies', 'contacts', 'leads', 'deals', 'activities', 'notes',
    'clients', 'projects', 'tasks', 'milestones',
    'campaigns', 'deliverables', 'content_items',
    'client_requests', 'retainers', 'contracts'
  ];
begin
  foreach target in array targets loop
    execute format(
      'create index if not exists %I on public.%I (workspace_id) where archived_at is null',
      target || '_live_idx', target
    );
    execute format(
      'create index if not exists %I on public.%I (workspace_id, archived_at desc) where archived_at is not null',
      target || '_archived_idx', target
    );
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Retention
--
-- Archived rows are not kept forever. This function is the controlled
-- hard-deletion path prd.md calls for: it is maintenance-only, scoped by age,
-- and returns what it removed so a scheduled run can be audited.
--
-- It is NOT granted to application roles — same reasoning as
-- cleanup_expired_jobs in 0022, which was callable by any authenticated user
-- and deleted across every tenant.
-- ---------------------------------------------------------------------------
create or replace function public.purge_archived_records(p_older_than interval default interval '90 days')
returns table (table_name text, purged integer)
language plpgsql
security definer set search_path = public
as $$
declare
  target text;
  targets text[] := array[
    'activities', 'notes', 'tasks', 'milestones', 'deliverables',
    'content_items', 'campaigns', 'client_requests', 'projects',
    'leads', 'deals', 'contacts', 'companies', 'clients',
    'retainers', 'contracts'
  ];
  removed integer;
begin
  if p_older_than is null or p_older_than < interval '1 day' then
    raise exception 'Refusing to purge records archived less than a day ago';
  end if;

  -- Ordered child-before-parent so foreign keys do not block the delete.
  foreach target in array targets loop
    execute format(
      'delete from public.%I where archived_at is not null and archived_at < now() - $1',
      target
    ) using p_older_than;
    get diagnostics removed = row_count;
    table_name := target;
    purged := removed;
    return next;
  end loop;
end;
$$;

revoke all on function public.purge_archived_records(interval) from public, anon, authenticated;
grant execute on function public.purge_archived_records(interval) to service_role;

comment on function public.purge_archived_records(interval) is
  'Maintenance only. Permanently removes rows archived longer ago than p_older_than, across all workspaces, so it must never be callable by an application role. Run from pg_cron or a trusted worker.';
