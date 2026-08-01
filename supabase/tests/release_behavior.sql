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
