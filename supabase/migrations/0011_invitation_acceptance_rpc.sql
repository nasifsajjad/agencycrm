create or replace function public.accept_invitation(p_invitation_id uuid)
returns uuid
language plpgsql
security definer set search_path = public, private, auth
as $$
declare
  current_user_id uuid := auth.uid();
  invitation_row public.invitations%rowtype;
  membership_id uuid;
begin
  if current_user_id is null then raise exception 'Not authenticated'; end if;
  select * into invitation_row from public.invitations where id = p_invitation_id for update;
  if invitation_row.id is null or invitation_row.accepted_at is not null or invitation_row.revoked_at is not null or invitation_row.expires_at < now() then
    raise exception 'Invitation is no longer valid';
  end if;
  if lower(trim((select email from public.profiles where user_id = current_user_id))) <> invitation_row.email_normalized then
    raise exception 'Invitation email does not match authenticated user';
  end if;
  if exists (select 1 from public.workspace_memberships where workspace_id = invitation_row.workspace_id and user_id = current_user_id) then
    raise exception 'Already a workspace member';
  end if;
  insert into public.workspace_memberships (workspace_id, user_id, status, title)
  values (invitation_row.workspace_id, current_user_id, 'active', 'Member')
  returning id into membership_id;
  insert into public.membership_roles (membership_id, role_id)
  select membership_id, role_id from public.invitation_roles where invitation_id = invitation_row.id;
  update public.invitations set accepted_at = now() where id = invitation_row.id;
  perform private.record_audit(invitation_row.workspace_id, 'invitation.accepted', 'invitation', invitation_row.id, null, jsonb_build_object('user_id', current_user_id), null, null);
  return invitation_row.workspace_id;
end;
$$;

revoke all on function public.accept_invitation(uuid) from public, anon;
grant execute on function public.accept_invitation(uuid) to authenticated;
