-- AgencyOS — Migration 0020: service-worker outbox claiming.

alter table public.outbox_events add column if not exists locked_at timestamptz;
create index if not exists outbox_claimable_idx
  on public.outbox_events(processed_at, next_attempt_at, locked_at);

create or replace function public.claim_outbox_events(p_limit integer default 50)
returns setof public.outbox_events
language plpgsql
security definer set search_path = public
as $$
begin
  if current_user not in ('service_role', 'postgres') then raise exception 'Worker role required'; end if;
  return query
  with candidates as (
    select id from public.outbox_events
    where processed_at is null
      and next_attempt_at <= now()
      and locked_at is null
    order by created_at asc
    limit greatest(1, least(coalesce(p_limit, 50), 100))
    for update skip locked
  )
  update public.outbox_events e
  set locked_at = now()
  from candidates c
  where e.id = c.id
  returning e.*;
end;
$$;

revoke all on function public.claim_outbox_events(integer) from public, anon, authenticated;
grant execute on function public.claim_outbox_events(integer) to service_role;
