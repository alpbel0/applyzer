create table public.rubric_versions (
  id serial primary key,
  weights jsonb not null,
  is_active boolean not null default false,
  description text,
  created_at timestamptz not null default now()
);

create unique index rubric_versions_one_active_idx
  on public.rubric_versions (is_active)
  where is_active = true;

alter table public.rubric_versions enable row level security;

revoke all on table public.rubric_versions from public, anon, authenticated;
revoke all on sequence public.rubric_versions_id_seq from public, anon, authenticated;

grant select, insert, update, delete on table public.rubric_versions to service_role;
grant usage, select on sequence public.rubric_versions_id_seq to service_role;
