-- Public, authenticated wrapper for the append-only audit writer. Ordinary
-- users cannot insert audit rows directly; this function validates the actor
-- through auth.uid() and delegates to the security-definer implementation.
create or replace function public.record_audit(
  p_workspace_id uuid,
  p_action text,
  p_entity_type text,
  p_entity_id uuid,
  p_before jsonb,
  p_after jsonb,
  p_ip_hash text default null,
  p_user_agent_summary text default null
)
returns void
language plpgsql
security definer set search_path = public, private, auth
as $$
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  if not private.is_workspace_member(p_workspace_id) then raise exception 'Not a workspace member'; end if;
  perform private.record_audit(
    p_workspace_id, p_action, p_entity_type, p_entity_id,
    p_before, p_after, p_ip_hash, p_user_agent_summary
  );
end;
$$;

revoke all on function public.record_audit(uuid, text, text, uuid, jsonb, jsonb, text, text) from public, anon;
grant execute on function public.record_audit(uuid, text, text, uuid, jsonb, jsonb, text, text) to authenticated;
