create table public.emails (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null,
  evaluation_id uuid not null,

  subject text not null,
  body text not null,
  draft_type public.recommendation not null,

  is_sent boolean not null default false,
  sent_at timestamptz,
  demo_mode boolean not null default false,
  provider_id text,
  error text,

  created_at timestamptz not null default now(),

  constraint emails_application_id_fkey
    foreign key (application_id)
    references public.applications (id)
    on delete cascade,
  constraint emails_evaluation_id_fkey
    foreign key (evaluation_id)
    references public.evaluations (id)
);

create index emails_application_id_idx on public.emails (application_id);
create index emails_evaluation_id_idx on public.emails (evaluation_id);

alter table public.emails enable row level security;

revoke all on table public.emails from public, anon, authenticated;
grant select, insert, update, delete on table public.emails to service_role;
