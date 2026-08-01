-- AgencyOS — Migration 0008: Storage buckets and storage.objects policies

-- Buckets (private)
-- Keep this portable across supported Supabase Storage schema revisions. The
-- optional public/file-size/MIME columns are absent from older local images;
-- omitting them preserves the private default and lets deployment configure
-- limits through Storage without making migration execution version-specific.
insert into storage.buckets (id, name)
values
  ('workspace-assets', 'workspace-assets'),
  ('avatars', 'avatars'),
  ('imports', 'imports'),
  ('exports', 'exports')
on conflict (id) do nothing;

-- Helper: extract workspace id from storage path.
-- Path convention: "<workspace_id>/<entity>/<filename>" or "<workspace_id>/<...>/<filename>".
-- The first path segment is always the workspace_id (a uuid).
create or replace function private.workspace_id_from_path(path text)
returns uuid
language sql
immutable
as $$
  select case
    when split_part(path, '/', 1) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      then split_part(path, '/', 1)::uuid
    else null
  end;
$$;

-- Helper: is the current user an active workspace member for the bucket object's path?
create or replace function private.can_access_storage_object(bucket_name text, object_path text)
returns boolean
language plpgsql
security definer set search_path = public, storage, auth
as $$
declare
  ws uuid;
begin
  -- Avatars: any authenticated user may read; only the owner may write to their own path
  if bucket_name = 'avatars' then
    if split_part(object_path, '/', 1) = auth.uid()::text then
      return true;
    end if;
    ws := private.workspace_id_from_path(object_path);
    if ws is null then return false; end if;
    return private.is_workspace_member(ws);
  end if;

  ws := private.workspace_id_from_path(object_path);
  if ws is null then return false; end if;
  return private.is_workspace_member(ws);
end;
$$;

revoke all on function private.can_access_storage_object(text, text) from public, anon;
grant execute on function private.can_access_storage_object(text, text) to authenticated;

-- Storage policies (applied to storage.objects)
-- SELECT: workspace members can read; exports bucket uses signed URLs (also gated by membership)
drop policy if exists storage_select on storage.objects;
create policy storage_select on storage.objects for select to authenticated
  using (private.can_access_storage_object(bucket_id, name));

-- INSERT: user must have files.upload in the workspace
drop policy if exists storage_insert on storage.objects;
create policy storage_insert on storage.objects for insert to authenticated
  with check (
    private.can_access_storage_object(bucket_id, name)
    and private.has_permission(private.workspace_id_from_path(name), 'files.upload')
  );

-- UPDATE: files.delete permission
drop policy if exists storage_update on storage.objects;
create policy storage_update on storage.objects for update to authenticated
  using (
    private.can_access_storage_object(bucket_id, name)
    and private.has_permission(private.workspace_id_from_path(name), 'files.delete')
  )
  with check (
    private.can_access_storage_object(bucket_id, name)
    and private.has_permission(private.workspace_id_from_path(name), 'files.delete')
  );

-- DELETE: files.delete permission
drop policy if exists storage_delete on storage.objects;
create policy storage_delete on storage.objects for delete to authenticated
  using (
    private.can_access_storage_object(bucket_id, name)
    and private.has_permission(private.workspace_id_from_path(name), 'files.delete')
  );

-- Exports bucket: any authenticated workspace member can read their workspace's exports
-- (handled by the same private.can_access_storage_object helper)
