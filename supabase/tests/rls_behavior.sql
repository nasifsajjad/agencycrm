-- Behavioral RLS smoke test. Run after `supabase db reset` against a local
-- Supabase database. It deliberately assumes no service-role bypass.
\set ON_ERROR_STOP on

begin;

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values
  ('10000000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'owner-a@example.test', 'not-used', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('20000000-0000-4000-8000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'owner-b@example.test', 'not-used', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now());

set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000001', true);
select public.create_workspace('Workspace A', 'workspace-a', 'USD', 'UTC');

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '20000000-0000-4000-8000-000000000002', true);
select public.create_workspace('Workspace B', 'workspace-b', 'USD', 'UTC');

reset role;
select set_config('app.workspace_a', id::text, true) from public.workspaces where slug = 'workspace-a';

set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000001', true);
insert into public.contacts (workspace_id, first_name, last_name, owner_user_id)
select id, 'Visible', 'Only To A', '10000000-0000-4000-8000-000000000001'
from public.workspaces where slug = 'workspace-a';

do $$
begin
  if (select count(*) from public.contacts) <> 1 then
    raise exception 'owner A must read its contact';
  end if;
end $$;

reset role;
insert into storage.objects (bucket_id, name, owner_id)
values (
  'workspace-assets',
  current_setting('app.workspace_a') || '/rls-smoke.txt',
  '10000000-0000-4000-8000-000000000001'
);
set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000001', true);
do $$
begin
  if not exists (
    select 1 from storage.objects
    where bucket_id = 'workspace-assets'
      and name = current_setting('app.workspace_a') || '/rls-smoke.txt'
  ) then
    raise exception 'owner A could not read its Storage object';
  end if;
end $$;

-- Portal visibility is explicit to the client, never inherited from a
-- workspace membership. Owner A creates a client portal; owner B must not see
-- either the client or its portal by guessing the IDs/slug.
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000001', true);
insert into public.clients (workspace_id, name, owner_user_id, portal_slug)
select id, 'Client A', owner_id, 'client-a-portal'
from public.workspaces where slug = 'workspace-a';
select set_config('app.client_a', id::text, true) from public.clients where portal_slug = 'client-a-portal';
insert into public.client_portals (workspace_id, client_id, slug)
select workspace_id, id, 'portal-a'
from public.clients where id = current_setting('app.client_a')::uuid;

select set_config('request.jwt.claim.sub', '20000000-0000-4000-8000-000000000002', true);
do $$
begin
  if exists (select 1 from public.clients where id = current_setting('app.client_a')::uuid) then
    raise exception 'owner B read a client from workspace A';
  end if;
  if exists (select 1 from public.client_portals where slug = 'portal-a') then
    raise exception 'owner B read a portal from workspace A';
  end if;
end $$;

-- Even an owner with workspace.update may not transfer ownership by updating
-- the row directly.
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000001', true);
do $$
begin
  begin
    update public.workspaces
    set owner_id = '20000000-0000-4000-8000-000000000002'
    where slug = 'workspace-a';
    raise exception 'workspace owner transfer unexpectedly succeeded';
  exception when raise_exception then
    if position('Workspace owner cannot be changed' in sqlerrm) = 0 then raise; end if;
  end;
end $$;

set local role authenticated;
select set_config('request.jwt.claim.sub', '20000000-0000-4000-8000-000000000002', true);

do $$
begin
  if exists (select 1 from public.contacts) then
    raise exception 'owner B read a cross-workspace contact';
  end if;
  if exists (
    select 1 from storage.objects
    where bucket_id = 'workspace-assets'
      and name = current_setting('app.workspace_a') || '/rls-smoke.txt'
  ) then
    raise exception 'owner B read a cross-workspace Storage object';
  end if;
  if exists (select 1 from public.workspaces where slug = 'workspace-a') then
    raise exception 'owner B read workspace A';
  end if;
end $$;

-- An INSERT directed at workspace A must be rejected by the policy's
-- WITH CHECK, rather than becoming a cross-workspace row.
do $$
begin
  begin
    insert into public.contacts (workspace_id, first_name, last_name, owner_user_id)
    values (current_setting('app.workspace_a')::uuid, 'Blocked', 'Insert', '20000000-0000-4000-8000-000000000002');
    raise exception 'cross-workspace INSERT unexpectedly succeeded';
  exception when insufficient_privilege then null;
  end;
end $$;

-- Trusted worker requests use service_role deliberately and can observe the
-- queued tenant record; ordinary authenticated requests above cannot.
reset role;
set local role service_role;
do $$
begin
  if not exists (select 1 from public.contacts where workspace_id = current_setting('app.workspace_a')::uuid) then
    raise exception 'service role could not read the tenant record';
  end if;
end $$;

reset role;
set local role anon;
do $$
begin
  begin
    perform 1 from public.contacts;
    raise exception 'anonymous SELECT unexpectedly succeeded';
  exception when insufficient_privilege then null;
  end;
end $$;

rollback;
