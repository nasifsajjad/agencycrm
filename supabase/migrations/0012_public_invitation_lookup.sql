create or replace function public.get_invitation(p_token_hash text)
returns table(invitation_id uuid, email_normalized text, workspace_name text, workspace_slug text, role_id uuid, role_name text)
language sql
security definer set search_path = public
as $$
  select i.id, i.email_normalized, w.name, w.slug, r.id, r.name
  from public.invitations i
  join public.workspaces w on w.id = i.workspace_id
  left join public.invitation_roles ir on ir.invitation_id = i.id
  left join public.roles r on r.id = ir.role_id
  where i.token_hash = p_token_hash
    and i.accepted_at is null
    and i.revoked_at is null
    and i.expires_at > now();
$$;

revoke all on function public.get_invitation(text) from public;
grant execute on function public.get_invitation(text) to anon, authenticated;
