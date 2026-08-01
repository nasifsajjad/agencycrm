-- AgencyOS — Migration 0005: Time, capacity, finance, customization, automation

-- Time entries
create table if not exists public.time_entries (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  project_id uuid references public.projects(id),
  task_id uuid references public.tasks(id),
  client_id uuid references public.clients(id),
  user_id uuid not null references public.profiles(user_id) on delete cascade,
  started_at timestamptz not null,
  ended_at timestamptz,
  minutes integer not null default 0 check (minutes >= 0),
  description text,
  billable boolean not null default true,
  rate_minor bigint not null default 0,
  currency text not null default 'USD',
  status time_entry_status not null default 'open',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists time_entries_workspace_user_started_idx on public.time_entries(workspace_id, user_id, started_at desc);
create index if not exists time_entries_workspace_project_idx on public.time_entries(workspace_id, project_id);
create trigger time_entries_updated_at before update on public.time_entries
  for each row execute function public.tg_set_updated_at();

create table if not exists public.timesheets (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references public.profiles(user_id) on delete cascade,
  period_start date not null,
  period_end date not null,
  status text not null default 'open',
  submitted_at timestamptz,
  approved_at timestamptz,
  approved_by uuid references public.profiles(user_id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, user_id, period_start)
);

create trigger timesheets_updated_at before update on public.timesheets
  for each row execute function public.tg_set_updated_at();

create table if not exists public.capacity_allocations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references public.profiles(user_id) on delete cascade,
  project_id uuid references public.projects(id),
  starts_on date not null,
  ends_on date not null,
  allocated_minutes integer not null default 0
);

create index if not exists capacity_workspace_user_starts_idx on public.capacity_allocations(workspace_id, user_id, starts_on);

create table if not exists public.rate_cards (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  client_id uuid references public.clients(id),
  service_id uuid references public.services(id),
  role_id uuid references public.roles(id),
  rate_minor bigint not null default 0,
  currency text not null default 'USD',
  starts_on date not null default current_date
);

create index if not exists rate_cards_workspace_client_idx on public.rate_cards(workspace_id, client_id);

-- Finance
create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  client_id uuid references public.clients(id),
  project_id uuid references public.projects(id),
  category text not null,
  amount_minor bigint not null default 0,
  currency text not null default 'USD',
  incurred_on date not null default current_date,
  billable boolean not null default false,
  receipt_file_id uuid references public.files(id),
  status text not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists expenses_workspace_client_idx on public.expenses(workspace_id, client_id);
create trigger expenses_updated_at before update on public.expenses
  for each row execute function public.tg_set_updated_at();

create table if not exists public.estimates (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  client_id uuid references public.clients(id),
  status text not null default 'draft',
  currency text not null default 'USD',
  subtotal_minor bigint not null default 0,
  tax_minor bigint not null default 0,
  total_minor bigint not null default 0,
  valid_until date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger estimates_updated_at before update on public.estimates
  for each row execute function public.tg_set_updated_at();

create table if not exists public.estimate_lines (
  id uuid primary key default gen_random_uuid(),
  estimate_id uuid not null references public.estimates(id) on delete cascade,
  description text not null,
  quantity_decimal numeric(12,3) not null default 1,
  unit_price_minor bigint not null default 0,
  tax_rate_decimal numeric(5,4) not null default 0
);

create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  client_id uuid references public.clients(id),
  number text not null,
  status text not null default 'draft',
  currency text not null default 'USD',
  issued_on date not null default current_date,
  due_on date,
  subtotal_minor bigint not null default 0,
  tax_minor bigint not null default 0,
  total_minor bigint not null default 0,
  paid_minor bigint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, number)
);

create trigger invoices_updated_at before update on public.invoices
  for each row execute function public.tg_set_updated_at();

create table if not exists public.invoice_lines (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  description text not null,
  quantity_decimal numeric(12,3) not null default 1,
  unit_price_minor bigint not null default 0,
  tax_rate_decimal numeric(5,4) not null default 0,
  project_id uuid references public.projects(id),
  time_entry_id uuid references public.time_entries(id)
);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  provider_reference text,
  amount_minor bigint not null default 0,
  currency text not null default 'USD',
  paid_at timestamptz not null default now(),
  status text not null default 'completed'
);

-- Customization
create table if not exists public.custom_field_definitions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  entity_type text not null,
  key text not null,
  label text not null,
  data_type text not null,
  required boolean not null default false,
  options_json jsonb,
  validation_json jsonb,
  position integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, entity_type, key)
);

create trigger cf_def_updated_at before update on public.custom_field_definitions
  for each row execute function public.tg_set_updated_at();

create table if not exists public.custom_field_values (
  id uuid primary key default gen_random_uuid(),
  definition_id uuid not null references public.custom_field_definitions(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  entity_type text not null,
  entity_id uuid not null,
  value_json jsonb,
  unique (definition_id, entity_id)
);

create index if not exists cf_values_workspace_entity_idx on public.custom_field_values(workspace_id, entity_type, entity_id);

create table if not exists public.saved_views (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  entity_type text not null,
  name text not null,
  owner_user_id uuid references public.profiles(user_id),
  visibility visibility not null default 'private',
  query_json jsonb,
  columns_json jsonb,
  sort_json jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, entity_type, name)
);

create trigger saved_views_updated_at before update on public.saved_views
  for each row execute function public.tg_set_updated_at();

create table if not exists public.dashboards (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null,
  owner_user_id uuid references public.profiles(user_id),
  visibility visibility not null default 'workspace',
  layout_json jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger dashboards_updated_at before update on public.dashboards
  for each row execute function public.tg_set_updated_at();

create table if not exists public.dashboard_widgets (
  id uuid primary key default gen_random_uuid(),
  dashboard_id uuid not null references public.dashboards(id) on delete cascade,
  widget_type text not null,
  query_json jsonb,
  display_json jsonb,
  position_json jsonb
);

create table if not exists public.report_definitions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null,
  subject_type text not null,
  dimensions_json jsonb,
  measures_json jsonb,
  filters_json jsonb,
  visualization_json jsonb,
  visibility visibility not null default 'workspace',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger report_def_updated_at before update on public.report_definitions
  for each row execute function public.tg_set_updated_at();

-- Automation
create table if not exists public.automations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null,
  trigger_type text not null,
  trigger_config_json jsonb,
  condition_tree_json jsonb,
  enabled boolean not null default true,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger automations_updated_at before update on public.automations
  for each row execute function public.tg_set_updated_at();

create table if not exists public.automation_actions (
  id uuid primary key default gen_random_uuid(),
  automation_id uuid not null references public.automations(id) on delete cascade,
  position integer not null default 0,
  action_type text not null,
  config_json jsonb
);

create table if not exists public.automation_runs (
  id uuid primary key default gen_random_uuid(),
  automation_id uuid not null references public.automations(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  trigger_event_id uuid,
  status automation_run_status not null default 'pending',
  idempotency_key text unique,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  error_summary text
);

create index if not exists automation_runs_status_idx on public.automation_runs(status, started_at);

create table if not exists public.automation_action_runs (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.automation_runs(id) on delete cascade,
  action_id uuid not null references public.automation_actions(id) on delete cascade,
  status text not null default 'pending',
  attempts integer not null default 0,
  output_json jsonb,
  error_summary text
);

-- Transactional outbox
create table if not exists public.outbox_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  event_type text not null,
  entity_type text not null,
  entity_id uuid,
  actor_user_id uuid references public.profiles(user_id),
  payload jsonb not null,
  created_at timestamptz not null default now(),
  processed_at timestamptz,
  attempts integer not null default 0,
  next_attempt_at timestamptz not null default now()
);

create index if not exists outbox_unprocessed_idx on public.outbox_events(processed_at, next_attempt_at);

-- Webhooks
create table if not exists public.webhook_endpoints (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  url text not null,
  secret_ciphertext text,
  event_types_json jsonb,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger webhook_endpoints_updated_at before update on public.webhook_endpoints
  for each row execute function public.tg_set_updated_at();

create table if not exists public.webhook_deliveries (
  id uuid primary key default gen_random_uuid(),
  endpoint_id uuid not null references public.webhook_endpoints(id) on delete cascade,
  event_id uuid not null,
  status text not null default 'pending',
  attempts integer not null default 0,
  next_attempt_at timestamptz,
  response_code integer
);

create table if not exists public.integration_connections (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  provider text not null,
  status text not null default 'disconnected',
  scopes_json jsonb,
  credential_reference text,
  connected_by uuid references public.profiles(user_id),
  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger integration_conn_updated_at before update on public.integration_connections
  for each row execute function public.tg_set_updated_at();

create table if not exists public.import_jobs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  type text not null,
  file_id uuid references public.files(id),
  mapping_json jsonb,
  status import_job_status not null default 'pending',
  totals_json jsonb,
  error_file_id uuid references public.files(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger import_jobs_updated_at before update on public.import_jobs
  for each row execute function public.tg_set_updated_at();

create table if not exists public.export_jobs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  type text not null,
  query_json jsonb,
  status text not null default 'pending',
  object_path text,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger export_jobs_updated_at before update on public.export_jobs
  for each row execute function public.tg_set_updated_at();

-- Client portal & knowledge
create table if not exists public.client_portals (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  slug text not null unique,
  contact_id uuid references public.contacts(id),
  brand_color text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger client_portals_updated_at before update on public.client_portals
  for each row execute function public.tg_set_updated_at();

create table if not exists public.knowledge_pages (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  title text not null,
  slug text not null,
  body_rich text not null,
  client_id uuid references public.clients(id),
  project_id uuid references public.projects(id),
  visibility visibility not null default 'internal',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, slug)
);

create trigger knowledge_pages_updated_at before update on public.knowledge_pages
  for each row execute function public.tg_set_updated_at();
