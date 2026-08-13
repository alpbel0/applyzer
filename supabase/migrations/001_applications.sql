create type public.application_status as enum (
  'pending',
  'evaluating',
  'done',
  'failed'
);

create type public.cv_parse_status as enum ('ok', 'partial', 'failed');

create table public.applications (
  id uuid primary key default gen_random_uuid(),
  application_number serial not null,

  full_name text not null,
  email text not null,
  department_year text not null,
  technologies text not null,
  bonus_tools text[] not null default '{}'::text[],
  links text,
  self_introduction text not null,
  llm_experience text not null,
  office_days_per_week text not null,

  cv_storage_path text not null,
  cv_file_name text not null,
  cv_text text,
  cv_parse_status public.cv_parse_status,

  status public.application_status not null default 'pending',
  error_message text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint applications_application_number_key unique (application_number)
);

create index applications_status_idx on public.applications (status);
create index applications_email_idx on public.applications (email);
create index applications_created_at_idx on public.applications (created_at desc);

alter table public.applications enable row level security;

revoke all on table public.applications from public, anon, authenticated;
revoke all on sequence public.applications_application_number_seq from public, anon, authenticated;

grant usage on schema public to service_role;
grant select, insert, update, delete on table public.applications to service_role;
grant usage, select on sequence public.applications_application_number_seq to service_role;
