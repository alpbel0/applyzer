create type public.enrichment_status as enum (
  'ok',
  'partial',
  'unreachable',
  'skipped'
);

create table public.enrichment_results (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null,
  source text not null,
  url text not null,
  status public.enrichment_status not null,
  data jsonb,
  error text,
  fetched_at timestamptz not null default now(),
  duration_ms integer,

  constraint enrichment_results_application_id_fkey
    foreign key (application_id)
    references public.applications (id)
    on delete cascade
);

create index enrichment_results_application_id_idx
  on public.enrichment_results (application_id);

alter table public.enrichment_results enable row level security;

revoke all on table public.enrichment_results from public, anon, authenticated;
grant select, insert, update, delete on table public.enrichment_results to service_role;
