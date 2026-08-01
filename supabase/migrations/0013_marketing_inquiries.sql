-- Public marketing forms persist to Supabase without exposing submissions.
create table if not exists public.marketing_inquiries (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('contact', 'demo')),
  first_name text,
  last_name text,
  name text,
  email text not null check (length(email) between 3 and 320),
  agency text not null check (length(agency) between 1 and 200),
  message text,
  team_size text,
  created_at timestamptz not null default now(),
  check (
    (kind = 'contact' and first_name is not null and last_name is not null and message is not null and name is null and team_size is null)
    or
    (kind = 'demo' and name is not null and first_name is null and last_name is null and message is null)
  )
);

alter table public.marketing_inquiries enable row level security;
revoke all on public.marketing_inquiries from anon, authenticated;
grant insert on public.marketing_inquiries to anon, authenticated;

create policy marketing_inquiries_insert
on public.marketing_inquiries
for insert
to anon, authenticated
with check (
  kind in ('contact', 'demo')
  and length(email) between 3 and 320
  and length(agency) between 1 and 200
);
