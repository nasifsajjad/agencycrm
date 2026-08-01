-- AgencyOS — Migration 0007: RLS policies on every exposed tenant-owned table
-- Pattern: caller must be active member of the row's workspace AND (for write) hold the required permission.
-- WITH CHECK prevents changing workspace_id, owner, or protected state to escape authorization.

-- Enable RLS on every tenant-owned table
alter table public.workspaces enable row level security;
alter table public.profiles enable row level security;
alter table public.workspace_memberships enable row level security;
alter table public.roles enable row level security;
alter table public.role_permissions enable row level security;
alter table public.permissions enable row level security;
alter table public.membership_roles enable row level security;
alter table public.teams enable row level security;
alter table public.team_memberships enable row level security;
alter table public.invitations enable row level security;
alter table public.invitation_roles enable row level security;
alter table public.invitation_teams enable row level security;
alter table public.feature_flags enable row level security;
alter table public.workspace_preferences enable row level security;
alter table public.companies enable row level security;
alter table public.contacts enable row level security;
alter table public.leads enable row level security;
alter table public.pipelines enable row level security;
alter table public.pipeline_stages enable row level security;
alter table public.deals enable row level security;
alter table public.activities enable row level security;
alter table public.tags enable row level security;
alter table public.notes enable row level security;
alter table public.clients enable row level security;
alter table public.client_contacts enable row level security;
alter table public.services enable row level security;
alter table public.retainers enable row level security;
alter table public.contracts enable row level security;
alter table public.client_requests enable row level security;
alter table public.client_health_events enable row level security;
alter table public.project_templates enable row level security;
alter table public.project_statuses enable row level security;
alter table public.projects enable row level security;
alter table public.project_members enable row level security;
alter table public.milestones enable row level security;
alter table public.task_statuses enable row level security;
alter table public.tasks enable row level security;
alter table public.task_dependencies enable row level security;
alter table public.task_watchers enable row level security;
alter table public.campaigns enable row level security;
alter table public.deliverables enable row level security;
alter table public.content_items enable row level security;
alter table public.comments enable row level security;
alter table public.comment_mentions enable row level security;
alter table public.activity_events enable row level security;
alter table public.notifications enable row level security;
alter table public.files enable row level security;
alter table public.file_links enable row level security;
alter table public.deliverable_versions enable row level security;
alter table public.approval_requests enable row level security;
alter table public.approval_steps enable row level security;
alter table public.approval_events enable row level security;
alter table public.time_entries enable row level security;
alter table public.timesheets enable row level security;
alter table public.capacity_allocations enable row level security;
alter table public.rate_cards enable row level security;
alter table public.expenses enable row level security;
alter table public.estimates enable row level security;
alter table public.estimate_lines enable row level security;
alter table public.invoices enable row level security;
alter table public.invoice_lines enable row level security;
alter table public.payments enable row level security;
alter table public.custom_field_definitions enable row level security;
alter table public.custom_field_values enable row level security;
alter table public.saved_views enable row level security;
alter table public.dashboards enable row level security;
alter table public.dashboard_widgets enable row level security;
alter table public.report_definitions enable row level security;
alter table public.automations enable row level security;
alter table public.automation_actions enable row level security;
alter table public.automation_runs enable row level security;
alter table public.automation_action_runs enable row level security;
alter table public.outbox_events enable row level security;
alter table public.webhook_endpoints enable row level security;
alter table public.webhook_deliveries enable row level security;
alter table public.integration_connections enable row level security;
alter table public.import_jobs enable row level security;
alter table public.export_jobs enable row level security;
alter table public.client_portals enable row level security;
alter table public.knowledge_pages enable row level security;
alter table audit.events enable row level security;

-- Supabase roles need table privileges in addition to RLS policies. Without
-- these grants every policy is unreachable and authenticated API calls fail
-- with "permission denied" before RLS is evaluated.
grant select, insert, update, delete on all tables in schema public to authenticated;

-- ============ Workspaces ============
create policy workspaces_select on public.workspaces for select to authenticated
  using (private.is_workspace_member(id));
create policy workspaces_update on public.workspaces for update to authenticated
  using (private.has_permission(id, 'workspace.update'))
  with check (private.has_permission(id, 'workspace.update') and owner_id = (select owner_id from public.workspaces where id = id));
create policy workspaces_delete on public.workspaces for delete to authenticated
  using (private.has_permission(id, 'workspace.delete'));

-- ============ Profiles ============
create policy profiles_select on public.profiles for select to authenticated
  using (
    user_id = auth.uid()
    or user_id in (
      select m.user_id from public.workspace_memberships m
      where m.status = 'active'
        and m.workspace_id in (select unnest(private.active_workspace_ids()))
    )
  );
create policy profiles_update on public.profiles for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ============ Memberships ============
create policy memberships_select on public.workspace_memberships for select to authenticated
  using (private.is_workspace_member(workspace_id) or user_id = auth.uid());
create policy memberships_insert on public.workspace_memberships for insert to authenticated
  with check (private.has_permission(workspace_id, 'members.invite'));
create policy memberships_update on public.workspace_memberships for update to authenticated
  using (private.has_permission(workspace_id, 'members.update'))
  with check (private.has_permission(workspace_id, 'members.update'));
create policy memberships_delete on public.workspace_memberships for delete to authenticated
  using (private.has_permission(workspace_id, 'members.remove'));

-- ============ Roles ============
create policy roles_select on public.roles for select to authenticated
  using (private.is_workspace_member(workspace_id));
create policy roles_insert on public.roles for insert to authenticated
  with check (private.has_permission(workspace_id, 'roles.manage'));
create policy roles_update on public.roles for update to authenticated
  using (private.has_permission(workspace_id, 'roles.manage'))
  with check (private.has_permission(workspace_id, 'roles.manage'));
create policy roles_delete on public.roles for delete to authenticated
  using (private.has_permission(workspace_id, 'roles.manage'));

-- Permissions catalogue: read-only to authenticated
create policy permissions_select on public.permissions for select to authenticated using (true);

-- role_permissions: visible to workspace members
create policy role_permissions_select on public.role_permissions for select to authenticated
  using (exists (
    select 1 from public.roles r where r.id = role_id and private.is_workspace_member(r.workspace_id)
  ));
create policy role_permissions_insert on public.role_permissions for insert to authenticated
  with check (exists (
    select 1 from public.roles r where r.id = role_id and private.has_permission(r.workspace_id, 'roles.manage')
  ));
create policy role_permissions_delete on public.role_permissions for delete to authenticated
  using (exists (
    select 1 from public.roles r where r.id = role_id and private.has_permission(r.workspace_id, 'roles.manage')
  ));

-- membership_roles: visible to workspace members
create policy membership_roles_select on public.membership_roles for select to authenticated
  using (exists (
    select 1 from public.workspace_memberships m
    join public.roles r on r.id = membership_roles.role_id
    where m.id = membership_roles.membership_id and private.is_workspace_member(r.workspace_id)
  ));
create policy membership_roles_insert on public.membership_roles for insert to authenticated
  with check (exists (
    select 1 from public.workspace_memberships m
    join public.roles r on r.id = membership_roles.role_id
    where m.id = membership_roles.membership_id and private.has_permission(r.workspace_id, 'roles.manage')
  ));
create policy membership_roles_delete on public.membership_roles for delete to authenticated
  using (exists (
    select 1 from public.workspace_memberships m
    join public.roles r on r.id = membership_roles.role_id
    where m.id = membership_roles.membership_id and private.has_permission(r.workspace_id, 'roles.manage')
  ));

-- ============ Teams ============
create policy teams_select on public.teams for select to authenticated
  using (private.is_workspace_member(workspace_id));
create policy teams_insert on public.teams for insert to authenticated
  with check (private.has_permission(workspace_id, 'teams.manage'));
create policy teams_update on public.teams for update to authenticated
  using (private.has_permission(workspace_id, 'teams.manage'))
  with check (private.has_permission(workspace_id, 'teams.manage'));
create policy teams_delete on public.teams for delete to authenticated
  using (private.has_permission(workspace_id, 'teams.manage'));

create policy team_memberships_select on public.team_memberships for select to authenticated
  using (exists (select 1 from public.teams t where t.id = team_id and private.is_workspace_member(t.workspace_id)));
create policy team_memberships_insert on public.team_memberships for insert to authenticated
  with check (exists (select 1 from public.teams t where t.id = team_id and private.has_permission(t.workspace_id, 'teams.manage')));
create policy team_memberships_delete on public.team_memberships for delete to authenticated
  using (exists (select 1 from public.teams t where t.id = team_id and private.has_permission(t.workspace_id, 'teams.manage')));

-- ============ Invitations ============
create policy invitations_select on public.invitations for select to authenticated
  using (private.is_workspace_member(workspace_id));
create policy invitations_insert on public.invitations for insert to authenticated
  with check (private.has_permission(workspace_id, 'members.invite'));
create policy invitations_update on public.invitations for update to authenticated
  using (private.has_permission(workspace_id, 'members.invite'))
  with check (private.has_permission(workspace_id, 'members.invite'));
create policy invitations_delete on public.invitations for delete to authenticated
  using (private.has_permission(workspace_id, 'members.invite'));

create policy invitation_roles_select on public.invitation_roles for select to authenticated
  using (exists (select 1 from public.invitations i where i.id = invitation_id and private.is_workspace_member(i.workspace_id)));
create policy invitation_roles_insert on public.invitation_roles for insert to authenticated
  with check (exists (select 1 from public.invitations i where i.id = invitation_id and private.has_permission(i.workspace_id, 'members.invite')));
create policy invitation_roles_delete on public.invitation_roles for delete to authenticated
  using (exists (select 1 from public.invitations i where i.id = invitation_id and private.has_permission(i.workspace_id, 'members.invite')));

create policy invitation_teams_select on public.invitation_teams for select to authenticated
  using (exists (select 1 from public.invitations i where i.id = invitation_id and private.is_workspace_member(i.workspace_id)));

-- Feature flags
create policy feature_flags_select on public.feature_flags for select to authenticated
  using (private.is_workspace_member(workspace_id));
create policy feature_flags_update on public.feature_flags for update to authenticated
  using (private.has_permission(workspace_id, 'settings.manage'))
  with check (private.has_permission(workspace_id, 'settings.manage'));

-- Workspace preferences
create policy workspace_prefs_select on public.workspace_preferences for select to authenticated
  using (private.is_workspace_member(workspace_id) and user_id = auth.uid());
create policy workspace_prefs_upsert on public.workspace_preferences for insert to authenticated
  with check (private.is_workspace_member(workspace_id) and user_id = auth.uid());
create policy workspace_prefs_update on public.workspace_preferences for update to authenticated
  using (private.is_workspace_member(workspace_id) and user_id = auth.uid())
  with check (private.is_workspace_member(workspace_id) and user_id = auth.uid());

-- Audit events: read-only to workspace members with audit.read
create policy audit_events_select on audit.events for select to authenticated
  using (private.has_permission(workspace_id, 'audit.read'));
-- No insert/update/delete policy on audit.events for authenticated — only service role + private.record_audit can write.

-- ============ Reusable macro-like policies for tenant-owned tables ============
-- Companies
create policy companies_select on public.companies for select to authenticated
  using (private.is_workspace_member(workspace_id));
create policy companies_insert on public.companies for insert to authenticated
  with check (private.has_permission(workspace_id, 'crm.create') and workspace_id = workspace_id);
create policy companies_update on public.companies for update to authenticated
  using (private.has_permission(workspace_id, 'crm.update'))
  with check (private.has_permission(workspace_id, 'crm.update'));
create policy companies_delete on public.companies for delete to authenticated
  using (private.has_permission(workspace_id, 'crm.delete'));

-- Contacts
create policy contacts_select on public.contacts for select to authenticated
  using (private.is_workspace_member(workspace_id));
create policy contacts_insert on public.contacts for insert to authenticated
  with check (private.has_permission(workspace_id, 'crm.create'));
create policy contacts_update on public.contacts for update to authenticated
  using (private.has_permission(workspace_id, 'crm.update'))
  with check (private.has_permission(workspace_id, 'crm.update'));
create policy contacts_delete on public.contacts for delete to authenticated
  using (private.has_permission(workspace_id, 'crm.delete'));

-- Leads
create policy leads_select on public.leads for select to authenticated
  using (private.is_workspace_member(workspace_id));
create policy leads_insert on public.leads for insert to authenticated
  with check (private.has_permission(workspace_id, 'crm.create'));
create policy leads_update on public.leads for update to authenticated
  using (private.has_permission(workspace_id, 'crm.update'))
  with check (private.has_permission(workspace_id, 'crm.update'));
create policy leads_delete on public.leads for delete to authenticated
  using (private.has_permission(workspace_id, 'crm.delete'));

-- Pipelines + stages
create policy pipelines_select on public.pipelines for select to authenticated
  using (private.is_workspace_member(workspace_id));
create policy pipelines_insert on public.pipelines for insert to authenticated
  with check (private.has_permission(workspace_id, 'settings.manage'));
create policy pipelines_update on public.pipelines for update to authenticated
  using (private.has_permission(workspace_id, 'settings.manage'))
  with check (private.has_permission(workspace_id, 'settings.manage'));
create policy pipelines_delete on public.pipelines for delete to authenticated
  using (private.has_permission(workspace_id, 'settings.manage'));

create policy pipeline_stages_select on public.pipeline_stages for select to authenticated
  using (exists (select 1 from public.pipelines p where p.id = pipeline_id and private.is_workspace_member(p.workspace_id)));
create policy pipeline_stages_insert on public.pipeline_stages for insert to authenticated
  with check (exists (select 1 from public.pipelines p where p.id = pipeline_id and private.has_permission(p.workspace_id, 'settings.manage')));
create policy pipeline_stages_update on public.pipeline_stages for update to authenticated
  using (exists (select 1 from public.pipelines p where p.id = pipeline_id and private.has_permission(p.workspace_id, 'settings.manage')))
  with check (exists (select 1 from public.pipelines p where p.id = pipeline_id and private.has_permission(p.workspace_id, 'settings.manage')));
create policy pipeline_stages_delete on public.pipeline_stages for delete to authenticated
  using (exists (select 1 from public.pipelines p where p.id = pipeline_id and private.has_permission(p.workspace_id, 'settings.manage')));

-- Deals
create policy deals_select on public.deals for select to authenticated
  using (private.is_workspace_member(workspace_id));
create policy deals_insert on public.deals for insert to authenticated
  with check (private.has_permission(workspace_id, 'crm.create'));
create policy deals_update on public.deals for update to authenticated
  using (private.has_permission(workspace_id, 'crm.update'))
  with check (private.has_permission(workspace_id, 'crm.update'));
create policy deals_delete on public.deals for delete to authenticated
  using (private.has_permission(workspace_id, 'crm.delete'));

-- Activities, tags, notes (CRM)
create policy activities_select on public.activities for select to authenticated
  using (private.is_workspace_member(workspace_id));
create policy activities_insert on public.activities for insert to authenticated
  with check (private.has_permission(workspace_id, 'crm.create'));
create policy activities_update on public.activities for update to authenticated
  using (private.has_permission(workspace_id, 'crm.update'))
  with check (private.has_permission(workspace_id, 'crm.update'));
create policy activities_delete on public.activities for delete to authenticated
  using (private.has_permission(workspace_id, 'crm.delete'));

create policy tags_select on public.tags for select to authenticated
  using (private.is_workspace_member(workspace_id));
create policy tags_insert on public.tags for insert to authenticated
  with check (private.has_permission(workspace_id, 'crm.create'));
create policy tags_update on public.tags for update to authenticated
  using (private.has_permission(workspace_id, 'crm.update'))
  with check (private.has_permission(workspace_id, 'crm.update'));
create policy tags_delete on public.tags for delete to authenticated
  using (private.has_permission(workspace_id, 'crm.delete'));

create policy notes_select on public.notes for select to authenticated
  using (private.is_workspace_member(workspace_id) and (
    visibility = 'internal' or visibility = 'client' or visibility = 'restricted'
  ));
create policy notes_insert on public.notes for insert to authenticated
  with check (private.is_workspace_member(workspace_id) and private.has_permission(workspace_id, 'comments.create'));
create policy notes_update on public.notes for update to authenticated
  using (private.is_workspace_member(workspace_id) and (author_user_id = auth.uid() or private.has_permission(workspace_id, 'comments.moderate')))
  with check (private.is_workspace_member(workspace_id));
create policy notes_delete on public.notes for delete to authenticated
  using (private.is_workspace_member(workspace_id) and (author_user_id = auth.uid() or private.has_permission(workspace_id, 'comments.moderate')));

-- Clients (workspace members + portal access via can_access_client)
create policy clients_select on public.clients for select to authenticated
  using (private.can_access_client(id));
create policy clients_insert on public.clients for insert to authenticated
  with check (private.has_permission(workspace_id, 'clients.create'));
create policy clients_update on public.clients for update to authenticated
  using (private.has_permission(workspace_id, 'clients.update'))
  with check (private.has_permission(workspace_id, 'clients.update'));
create policy clients_delete on public.clients for delete to authenticated
  using (private.has_permission(workspace_id, 'clients.delete'));

-- Client contacts
create policy client_contacts_select on public.client_contacts for select to authenticated
  using (private.can_access_client(client_id));
create policy client_contacts_insert on public.client_contacts for insert to authenticated
  with check (private.has_permission((select workspace_id from public.clients where id = client_id), 'clients.update'));
create policy client_contacts_update on public.client_contacts for update to authenticated
  using (private.has_permission((select workspace_id from public.clients where id = client_id), 'clients.update'))
  with check (private.has_permission((select workspace_id from public.clients where id = client_id), 'clients.update'));
create policy client_contacts_delete on public.client_contacts for delete to authenticated
  using (private.has_permission((select workspace_id from public.clients where id = client_id), 'clients.update'));

-- Services
create policy services_select on public.services for select to authenticated
  using (private.is_workspace_member(workspace_id));
create policy services_insert on public.services for insert to authenticated
  with check (private.has_permission(workspace_id, 'settings.manage'));
create policy services_update on public.services for update to authenticated
  using (private.has_permission(workspace_id, 'settings.manage'))
  with check (private.has_permission(workspace_id, 'settings.manage'));
create policy services_delete on public.services for delete to authenticated
  using (private.has_permission(workspace_id, 'settings.manage'));

-- Retainers, contracts, client_requests, client_health_events
create policy retainers_select on public.retainers for select to authenticated
  using (private.can_access_client(client_id));
create policy retainers_insert on public.retainers for insert to authenticated
  with check (private.has_permission(workspace_id, 'finance.manage'));
create policy retainers_update on public.retainers for update to authenticated
  using (private.has_permission(workspace_id, 'finance.manage'))
  with check (private.has_permission(workspace_id, 'finance.manage'));
create policy retainers_delete on public.retainers for delete to authenticated
  using (private.has_permission(workspace_id, 'finance.manage'));

create policy contracts_select on public.contracts for select to authenticated
  using (private.can_access_client(client_id));
create policy contracts_insert on public.contracts for insert to authenticated
  with check (private.has_permission(workspace_id, 'finance.manage'));
create policy contracts_update on public.contracts for update to authenticated
  using (private.has_permission(workspace_id, 'finance.manage'))
  with check (private.has_permission(workspace_id, 'finance.manage'));
create policy contracts_delete on public.contracts for delete to authenticated
  using (private.has_permission(workspace_id, 'finance.manage'));

create policy client_requests_select on public.client_requests for select to authenticated
  using (private.can_access_client(client_id));
create policy client_requests_insert on public.client_requests for insert to authenticated
  with check (private.has_permission(workspace_id, 'clients.update') or private.can_access_client(client_id));
create policy client_requests_update on public.client_requests for update to authenticated
  using (private.has_permission(workspace_id, 'clients.update'))
  with check (private.has_permission(workspace_id, 'clients.update'));
create policy client_requests_delete on public.client_requests for delete to authenticated
  using (private.has_permission(workspace_id, 'clients.update'));

create policy client_health_events_select on public.client_health_events for select to authenticated
  using (private.can_access_client(client_id));
create policy client_health_events_insert on public.client_health_events for insert to authenticated
  with check (private.has_permission(workspace_id, 'clients.update'));
create policy client_health_events_delete on public.client_health_events for delete to authenticated
  using (private.has_permission(workspace_id, 'clients.update'));

-- Projects
create policy projects_select on public.projects for select to authenticated
  using (private.can_access_project(id));
create policy projects_insert on public.projects for insert to authenticated
  with check (private.has_permission(workspace_id, 'projects.create'));
create policy projects_update on public.projects for update to authenticated
  using (private.has_permission(workspace_id, 'projects.update'))
  with check (private.has_permission(workspace_id, 'projects.update'));
create policy projects_delete on public.projects for delete to authenticated
  using (private.has_permission(workspace_id, 'projects.delete'));

-- Project members, milestones, tasks, task deps, watchers, campaigns, deliverables, content
create policy project_members_select on public.project_members for select to authenticated
  using (private.can_access_project(project_id));
create policy project_members_insert on public.project_members for insert to authenticated
  with check (private.has_permission((select workspace_id from public.projects where id = project_id), 'projects.update'));
create policy project_members_delete on public.project_members for delete to authenticated
  using (private.has_permission((select workspace_id from public.projects where id = project_id), 'projects.update'));

create policy milestones_select on public.milestones for select to authenticated
  using (private.can_access_project(project_id));
create policy milestones_insert on public.milestones for insert to authenticated
  with check (private.has_permission(workspace_id, 'projects.update'));
create policy milestones_update on public.milestones for update to authenticated
  using (private.has_permission(workspace_id, 'projects.update'))
  with check (private.has_permission(workspace_id, 'projects.update'));
create policy milestones_delete on public.milestones for delete to authenticated
  using (private.has_permission(workspace_id, 'projects.update'));

create policy tasks_select on public.tasks for select to authenticated
  using (private.is_workspace_member(workspace_id) or private.can_access_project(project_id));
create policy tasks_insert on public.tasks for insert to authenticated
  with check (private.has_permission(workspace_id, 'tasks.create'));
create policy tasks_update on public.tasks for update to authenticated
  using (private.has_permission(workspace_id, 'tasks.update'))
  with check (private.has_permission(workspace_id, 'tasks.update'));
create policy tasks_delete on public.tasks for delete to authenticated
  using (private.has_permission(workspace_id, 'tasks.delete'));

create policy task_deps_select on public.task_dependencies for select to authenticated
  using (private.is_workspace_member((select workspace_id from public.tasks where id = task_id)));
create policy task_deps_insert on public.task_dependencies for insert to authenticated
  with check (private.has_permission((select workspace_id from public.tasks where id = task_id), 'tasks.update'));
create policy task_deps_delete on public.task_dependencies for delete to authenticated
  using (private.has_permission((select workspace_id from public.tasks where id = task_id), 'tasks.update'));

create policy task_watchers_select on public.task_watchers for select to authenticated
  using (private.is_workspace_member((select workspace_id from public.tasks where id = task_id)) or user_id = auth.uid());
create policy task_watchers_insert on public.task_watchers for insert to authenticated
  with check (user_id = auth.uid() or private.has_permission((select workspace_id from public.tasks where id = task_id), 'tasks.update'));
create policy task_watchers_delete on public.task_watchers for delete to authenticated
  using (user_id = auth.uid() or private.has_permission((select workspace_id from public.tasks where id = task_id), 'tasks.update'));

create policy campaigns_select on public.campaigns for select to authenticated
  using (private.is_workspace_member(workspace_id) or (client_id is not null and private.can_access_client(client_id)));
create policy campaigns_insert on public.campaigns for insert to authenticated
  with check (private.has_permission(workspace_id, 'campaigns.manage'));
create policy campaigns_update on public.campaigns for update to authenticated
  using (private.has_permission(workspace_id, 'campaigns.manage'))
  with check (private.has_permission(workspace_id, 'campaigns.manage'));
create policy campaigns_delete on public.campaigns for delete to authenticated
  using (private.has_permission(workspace_id, 'campaigns.manage'));

create policy deliverables_select on public.deliverables for select to authenticated
  using (private.is_workspace_member(workspace_id) or (client_id is not null and private.can_access_client(client_id) and visibility = 'client'));
create policy deliverables_insert on public.deliverables for insert to authenticated
  with check (private.has_permission(workspace_id, 'projects.update'));
create policy deliverables_update on public.deliverables for update to authenticated
  using (private.has_permission(workspace_id, 'projects.update'))
  with check (private.has_permission(workspace_id, 'projects.update'));
create policy deliverables_delete on public.deliverables for delete to authenticated
  using (private.has_permission(workspace_id, 'projects.update'));

create policy content_items_select on public.content_items for select to authenticated
  using (private.is_workspace_member(workspace_id));
create policy content_items_insert on public.content_items for insert to authenticated
  with check (private.has_permission(workspace_id, 'content.manage'));
create policy content_items_update on public.content_items for update to authenticated
  using (private.has_permission(workspace_id, 'content.manage'))
  with check (private.has_permission(workspace_id, 'content.manage'));
create policy content_items_delete on public.content_items for delete to authenticated
  using (private.has_permission(workspace_id, 'content.manage'));

-- Comments: visibility-aware
create policy comments_select on public.comments for select to authenticated
  using (
    private.is_workspace_member(workspace_id) and (
      visibility = 'internal' or visibility = 'client' or visibility = 'restricted'
    )
    or (
    -- Portal users can see client-visible comments on entities they can access
    visibility = 'client' and private.can_access_entity(entity_type, entity_id)
    )
  );
create policy comments_insert on public.comments for insert to authenticated
  with check (private.is_workspace_member(workspace_id) and private.has_permission(workspace_id, 'comments.create'));
create policy comments_update on public.comments for update to authenticated
  using (private.is_workspace_member(workspace_id) and (author_user_id = auth.uid() or private.has_permission(workspace_id, 'comments.moderate')))
  with check (private.is_workspace_member(workspace_id));
create policy comments_delete on public.comments for delete to authenticated
  using (private.is_workspace_member(workspace_id) and (author_user_id = auth.uid() or private.has_permission(workspace_id, 'comments.moderate')));

-- Activity events
create policy activity_events_select on public.activity_events for select to authenticated
  using (
    (private.is_workspace_member(workspace_id) and (
      visibility = 'internal' or visibility = 'client'
    )) or (visibility = 'client' and private.can_access_entity(entity_type, entity_id))
  );

-- Notifications: per-user
create policy notifications_select on public.notifications for select to authenticated
  using (user_id = auth.uid());
create policy notifications_insert on public.notifications for insert to authenticated
  with check (user_id = auth.uid() or private.is_workspace_member(workspace_id));
create policy notifications_update on public.notifications for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
create policy notifications_delete on public.notifications for delete to authenticated
  using (user_id = auth.uid());

-- Files
create policy files_select on public.files for select to authenticated
  using (private.is_workspace_member(workspace_id) or (
    -- Portal users can see client-visible files linked to entities they can access
    visibility = 'client' and exists (
      select 1 from public.file_links fl
      where fl.file_id = files.id and private.can_access_entity(fl.entity_type, fl.entity_id)
    )
  ));
create policy files_insert on public.files for insert to authenticated
  with check (private.has_permission(workspace_id, 'files.upload'));
create policy files_update on public.files for update to authenticated
  using (private.has_permission(workspace_id, 'files.delete'))
  with check (private.has_permission(workspace_id, 'files.delete'));
create policy files_delete on public.files for delete to authenticated
  using (private.has_permission(workspace_id, 'files.delete'));

create policy file_links_select on public.file_links for select to authenticated
  using (private.is_workspace_member((select workspace_id from public.files where id = file_id)));
create policy file_links_insert on public.file_links for insert to authenticated
  with check (private.is_workspace_member((select workspace_id from public.files where id = file_id)));
create policy file_links_delete on public.file_links for delete to authenticated
  using (private.is_workspace_member((select workspace_id from public.files where id = file_id)));

-- Deliverable versions
create policy deliverable_versions_select on public.deliverable_versions for select to authenticated
  using (private.can_access_entity('deliverable', deliverable_id));
create policy deliverable_versions_insert on public.deliverable_versions for insert to authenticated
  with check (private.has_permission((select workspace_id from public.deliverables where id = deliverable_id), 'projects.update'));
create policy deliverable_versions_delete on public.deliverable_versions for delete to authenticated
  using (private.has_permission((select workspace_id from public.deliverables where id = deliverable_id), 'projects.update'));

-- Approvals
create policy approval_requests_select on public.approval_requests for select to authenticated
  using (private.is_workspace_member(workspace_id) or private.can_access_entity(entity_type, entity_id));
create policy approval_requests_insert on public.approval_requests for insert to authenticated
  with check (private.has_permission(workspace_id, 'approvals.request'));
create policy approval_requests_update on public.approval_requests for update to authenticated
  using (private.has_permission(workspace_id, 'approvals.decide') or private.can_access_entity(entity_type, entity_id))
  with check (private.has_permission(workspace_id, 'approvals.decide') or private.can_access_entity(entity_type, entity_id));

create policy approval_steps_select on public.approval_steps for select to authenticated
  using (exists (select 1 from public.approval_requests ar where ar.id = approval_request_id and (private.is_workspace_member(ar.workspace_id) or private.can_access_entity(ar.entity_type, ar.entity_id))));
create policy approval_steps_update on public.approval_steps for update to authenticated
  using (exists (select 1 from public.approval_requests ar where ar.id = approval_request_id and (private.has_permission(ar.workspace_id, 'approvals.decide') or private.can_access_entity(ar.entity_type, ar.entity_id))));

create policy approval_events_select on public.approval_events for select to authenticated
  using (exists (select 1 from public.approval_requests ar where ar.id = approval_request_id and (private.is_workspace_member(ar.workspace_id) or private.can_access_entity(ar.entity_type, ar.entity_id))));

-- Time entries: read_own / read_all
create policy time_entries_select on public.time_entries for select to authenticated
  using (
    private.is_workspace_member(workspace_id) and (
      user_id = auth.uid()
      or private.has_permission(workspace_id, 'time.read_all')
    )
  );
create policy time_entries_insert on public.time_entries for insert to authenticated
  with check (private.is_workspace_member(workspace_id) and user_id = auth.uid() and private.has_permission(workspace_id, 'time.manage_own'));
create policy time_entries_update on public.time_entries for update to authenticated
  using (private.is_workspace_member(workspace_id) and (user_id = auth.uid() or private.has_permission(workspace_id, 'time.approve')))
  with check (private.is_workspace_member(workspace_id));
create policy time_entries_delete on public.time_entries for delete to authenticated
  using (private.is_workspace_member(workspace_id) and user_id = auth.uid());

-- Timesheets
create policy timesheets_select on public.timesheets for select to authenticated
  using (private.is_workspace_member(workspace_id) and (user_id = auth.uid() or private.has_permission(workspace_id, 'time.read_all')));
create policy timesheets_insert on public.timesheets for insert to authenticated
  with check (private.is_workspace_member(workspace_id) and user_id = auth.uid());
create policy timesheets_update on public.timesheets for update to authenticated
  using (private.is_workspace_member(workspace_id) and (user_id = auth.uid() or private.has_permission(workspace_id, 'time.approve')));

-- Capacity
create policy capacity_allocations_select on public.capacity_allocations for select to authenticated
  using (private.is_workspace_member(workspace_id) and (user_id = auth.uid() or private.has_permission(workspace_id, 'time.read_all')));
create policy capacity_allocations_insert on public.capacity_allocations for insert to authenticated
  with check (private.has_permission(workspace_id, 'time.read_all'));
create policy capacity_allocations_update on public.capacity_allocations for update to authenticated
  using (private.has_permission(workspace_id, 'time.read_all'))
  with check (private.has_permission(workspace_id, 'time.read_all'));
create policy capacity_allocations_delete on public.capacity_allocations for delete to authenticated
  using (private.has_permission(workspace_id, 'time.read_all'));

-- Rate cards
create policy rate_cards_select on public.rate_cards for select to authenticated
  using (private.is_workspace_member(workspace_id));
create policy rate_cards_insert on public.rate_cards for insert to authenticated
  with check (private.has_permission(workspace_id, 'finance.manage'));
create policy rate_cards_update on public.rate_cards for update to authenticated
  using (private.has_permission(workspace_id, 'finance.manage'))
  with check (private.has_permission(workspace_id, 'finance.manage'));
create policy rate_cards_delete on public.rate_cards for delete to authenticated
  using (private.has_permission(workspace_id, 'finance.manage'));

-- Expenses, estimates, estimate_lines, invoices, invoice_lines, payments
create policy expenses_select on public.expenses for select to authenticated
  using (private.is_workspace_member(workspace_id) and private.has_permission(workspace_id, 'finance.read'));
create policy expenses_insert on public.expenses for insert to authenticated
  with check (private.has_permission(workspace_id, 'finance.manage'));
create policy expenses_update on public.expenses for update to authenticated
  using (private.has_permission(workspace_id, 'finance.manage'))
  with check (private.has_permission(workspace_id, 'finance.manage'));
create policy expenses_delete on public.expenses for delete to authenticated
  using (private.has_permission(workspace_id, 'finance.manage'));

create policy estimates_select on public.estimates for select to authenticated
  using (private.is_workspace_member(workspace_id) and private.has_permission(workspace_id, 'finance.read'));
create policy estimates_insert on public.estimates for insert to authenticated
  with check (private.has_permission(workspace_id, 'finance.manage'));
create policy estimates_update on public.estimates for update to authenticated
  using (private.has_permission(workspace_id, 'finance.manage'))
  with check (private.has_permission(workspace_id, 'finance.manage'));
create policy estimates_delete on public.estimates for delete to authenticated
  using (private.has_permission(workspace_id, 'finance.manage'));

create policy estimate_lines_select on public.estimate_lines for select to authenticated
  using (exists (select 1 from public.estimates e where e.id = estimate_id and private.is_workspace_member(e.workspace_id) and private.has_permission(e.workspace_id, 'finance.read')));

create policy invoices_select on public.invoices for select to authenticated
  using (private.is_workspace_member(workspace_id) and private.has_permission(workspace_id, 'finance.read'));
create policy invoices_insert on public.invoices for insert to authenticated
  with check (private.has_permission(workspace_id, 'finance.manage'));
create policy invoices_update on public.invoices for update to authenticated
  using (private.has_permission(workspace_id, 'finance.manage'))
  with check (private.has_permission(workspace_id, 'finance.manage'));
create policy invoices_delete on public.invoices for delete to authenticated
  using (private.has_permission(workspace_id, 'finance.manage'));

create policy invoice_lines_select on public.invoice_lines for select to authenticated
  using (exists (select 1 from public.invoices i where i.id = invoice_id and private.is_workspace_member(i.workspace_id) and private.has_permission(i.workspace_id, 'finance.read')));

create policy payments_select on public.payments for select to authenticated
  using (private.is_workspace_member(workspace_id) and private.has_permission(workspace_id, 'finance.read'));
create policy payments_insert on public.payments for insert to authenticated
  with check (private.has_permission(workspace_id, 'finance.manage'));

-- Customization tables
create policy cf_def_select on public.custom_field_definitions for select to authenticated
  using (private.is_workspace_member(workspace_id));
create policy cf_def_insert on public.custom_field_definitions for insert to authenticated
  with check (private.has_permission(workspace_id, 'settings.manage'));
create policy cf_def_update on public.custom_field_definitions for update to authenticated
  using (private.has_permission(workspace_id, 'settings.manage'))
  with check (private.has_permission(workspace_id, 'settings.manage'));
create policy cf_def_delete on public.custom_field_definitions for delete to authenticated
  using (private.has_permission(workspace_id, 'settings.manage'));

create policy cf_values_select on public.custom_field_values for select to authenticated
  using (private.is_workspace_member(workspace_id));
create policy cf_values_insert on public.custom_field_values for insert to authenticated
  with check (private.is_workspace_member(workspace_id));
create policy cf_values_update on public.custom_field_values for update to authenticated
  using (private.is_workspace_member(workspace_id))
  with check (private.is_workspace_member(workspace_id));
create policy cf_values_delete on public.custom_field_values for delete to authenticated
  using (private.is_workspace_member(workspace_id));

-- Saved views
create policy saved_views_select on public.saved_views for select to authenticated
  using (private.is_workspace_member(workspace_id) and (visibility <> 'private' or owner_user_id = auth.uid()));
create policy saved_views_insert on public.saved_views for insert to authenticated
  with check (private.is_workspace_member(workspace_id) and owner_user_id = auth.uid());
create policy saved_views_update on public.saved_views for update to authenticated
  using (private.is_workspace_member(workspace_id) and (owner_user_id = auth.uid() or private.has_permission(workspace_id, 'settings.manage')))
  with check (private.is_workspace_member(workspace_id));
create policy saved_views_delete on public.saved_views for delete to authenticated
  using (private.is_workspace_member(workspace_id) and (owner_user_id = auth.uid() or private.has_permission(workspace_id, 'settings.manage')));

-- Dashboards, widgets, reports
create policy dashboards_select on public.dashboards for select to authenticated
  using (private.is_workspace_member(workspace_id) and (visibility <> 'private' or owner_user_id = auth.uid()));
create policy dashboards_insert on public.dashboards for insert to authenticated
  with check (private.is_workspace_member(workspace_id));
create policy dashboards_update on public.dashboards for update to authenticated
  using (private.is_workspace_member(workspace_id) and (owner_user_id = auth.uid() or private.has_permission(workspace_id, 'settings.manage')))
  with check (private.is_workspace_member(workspace_id));
create policy dashboards_delete on public.dashboards for delete to authenticated
  using (private.is_workspace_member(workspace_id) and (owner_user_id = auth.uid() or private.has_permission(workspace_id, 'settings.manage')));

create policy dashboard_widgets_select on public.dashboard_widgets for select to authenticated
  using (exists (select 1 from public.dashboards d where d.id = dashboard_id and private.is_workspace_member(d.workspace_id)));
create policy dashboard_widgets_insert on public.dashboard_widgets for insert to authenticated
  with check (exists (select 1 from public.dashboards d where d.id = dashboard_id and private.is_workspace_member(d.workspace_id)));
create policy dashboard_widgets_update on public.dashboard_widgets for update to authenticated
  using (exists (select 1 from public.dashboards d where d.id = dashboard_id and private.is_workspace_member(d.workspace_id)));
create policy dashboard_widgets_delete on public.dashboard_widgets for delete to authenticated
  using (exists (select 1 from public.dashboards d where d.id = dashboard_id and private.is_workspace_member(d.workspace_id)));

create policy report_def_select on public.report_definitions for select to authenticated
  using (private.is_workspace_member(workspace_id));
create policy report_def_insert on public.report_definitions for insert to authenticated
  with check (private.has_permission(workspace_id, 'reports.create'));
create policy report_def_update on public.report_definitions for update to authenticated
  using (private.has_permission(workspace_id, 'reports.create'))
  with check (private.has_permission(workspace_id, 'reports.create'));
create policy report_def_delete on public.report_definitions for delete to authenticated
  using (private.has_permission(workspace_id, 'reports.create'));

-- Automations
create policy automations_select on public.automations for select to authenticated
  using (private.is_workspace_member(workspace_id));
create policy automations_insert on public.automations for insert to authenticated
  with check (private.has_permission(workspace_id, 'automations.manage'));
create policy automations_update on public.automations for update to authenticated
  using (private.has_permission(workspace_id, 'automations.manage'))
  with check (private.has_permission(workspace_id, 'automations.manage'));
create policy automations_delete on public.automations for delete to authenticated
  using (private.has_permission(workspace_id, 'automations.manage'));

create policy automation_actions_select on public.automation_actions for select to authenticated
  using (exists (select 1 from public.automations a where a.id = automation_id and private.is_workspace_member(a.workspace_id)));
create policy automation_actions_insert on public.automation_actions for insert to authenticated
  with check (exists (select 1 from public.automations a where a.id = automation_id and private.has_permission(a.workspace_id, 'automations.manage')));
create policy automation_actions_update on public.automation_actions for update to authenticated
  using (exists (select 1 from public.automations a where a.id = automation_id and private.has_permission(a.workspace_id, 'automations.manage')));
create policy automation_actions_delete on public.automation_actions for delete to authenticated
  using (exists (select 1 from public.automations a where a.id = automation_id and private.has_permission(a.workspace_id, 'automations.manage')));

create policy automation_runs_select on public.automation_runs for select to authenticated
  using (private.is_workspace_member(workspace_id));

create policy automation_action_runs_select on public.automation_action_runs for select to authenticated
  using (exists (select 1 from public.automation_runs ar where ar.id = run_id and private.is_workspace_member(ar.workspace_id)));

-- Outbox, webhooks, integrations
create policy outbox_events_select on public.outbox_events for select to authenticated
  using (private.has_permission(workspace_id, 'automations.read'));

create policy webhook_endpoints_select on public.webhook_endpoints for select to authenticated
  using (private.has_permission(workspace_id, 'integrations.read'));
create policy webhook_endpoints_insert on public.webhook_endpoints for insert to authenticated
  with check (private.has_permission(workspace_id, 'integrations.manage'));
create policy webhook_endpoints_update on public.webhook_endpoints for update to authenticated
  using (private.has_permission(workspace_id, 'integrations.manage'))
  with check (private.has_permission(workspace_id, 'integrations.manage'));
create policy webhook_endpoints_delete on public.webhook_endpoints for delete to authenticated
  using (private.has_permission(workspace_id, 'integrations.manage'));

create policy integration_connections_select on public.integration_connections for select to authenticated
  using (private.has_permission(workspace_id, 'integrations.read'));

create policy import_jobs_select on public.import_jobs for select to authenticated
  using (private.is_workspace_member(workspace_id));
create policy export_jobs_select on public.export_jobs for select to authenticated
  using (private.is_workspace_member(workspace_id));

-- Portals + knowledge
create policy client_portals_select on public.client_portals for select to authenticated
  using (private.is_workspace_member(workspace_id) or private.can_access_client(client_id));
create policy client_portals_insert on public.client_portals for insert to authenticated
  with check (private.has_permission(workspace_id, 'portal.manage'));
create policy client_portals_update on public.client_portals for update to authenticated
  using (private.has_permission(workspace_id, 'portal.manage'))
  with check (private.has_permission(workspace_id, 'portal.manage'));
create policy client_portals_delete on public.client_portals for delete to authenticated
  using (private.has_permission(workspace_id, 'portal.manage'));

create policy knowledge_pages_select on public.knowledge_pages for select to authenticated
  using (
    (private.is_workspace_member(workspace_id) and (visibility = 'internal' or visibility = 'client'))
    or (visibility = 'client' and (client_id is null or private.can_access_client(client_id)))
  );

-- Project statuses, task statuses, project templates — workspace members can read; settings.manage for writes
create policy project_statuses_select on public.project_statuses for select to authenticated
  using (private.is_workspace_member(workspace_id));
create policy project_statuses_insert on public.project_statuses for insert to authenticated
  with check (private.has_permission(workspace_id, 'settings.manage'));
create policy project_statuses_update on public.project_statuses for update to authenticated
  using (private.has_permission(workspace_id, 'settings.manage'))
  with check (private.has_permission(workspace_id, 'settings.manage'));
create policy project_statuses_delete on public.project_statuses for delete to authenticated
  using (private.has_permission(workspace_id, 'settings.manage'));

create policy task_statuses_select on public.task_statuses for select to authenticated
  using (private.is_workspace_member(workspace_id));
create policy task_statuses_insert on public.task_statuses for insert to authenticated
  with check (private.has_permission(workspace_id, 'settings.manage'));
create policy task_statuses_update on public.task_statuses for update to authenticated
  using (private.has_permission(workspace_id, 'settings.manage'))
  with check (private.has_permission(workspace_id, 'settings.manage'));
create policy task_statuses_delete on public.task_statuses for delete to authenticated
  using (private.has_permission(workspace_id, 'settings.manage'));

create policy project_templates_select on public.project_templates for select to authenticated
  using (private.is_workspace_member(workspace_id));
create policy project_templates_insert on public.project_templates for insert to authenticated
  with check (private.has_permission(workspace_id, 'settings.manage'));
create policy project_templates_update on public.project_templates for update to authenticated
  using (private.has_permission(workspace_id, 'settings.manage'))
  with check (private.has_permission(workspace_id, 'settings.manage'));
create policy project_templates_delete on public.project_templates for delete to authenticated
  using (private.has_permission(workspace_id, 'settings.manage'));

-- Webhook deliveries: visible via endpoint
create policy webhook_deliveries_select on public.webhook_deliveries for select to authenticated
  using (exists (select 1 from public.webhook_endpoints we where we.id = endpoint_id and private.has_permission(we.workspace_id, 'integrations.read')));
