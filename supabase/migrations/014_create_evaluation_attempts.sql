create table public.evaluation_attempts (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null,
  evaluation_id uuid,
  run_id uuid not null,
  attempt_number integer not null,
  outcome text not null,
  model text not null,
  tool_call_count integer not null default 0,
  duration_ms integer,
  raw_response jsonb,
  error_message text,
  created_at timestamptz not null default now(),

  constraint evaluation_attempts_application_id_fkey
    foreign key (application_id)
    references public.applications (id)
    on delete cascade,
  constraint evaluation_attempts_evaluation_id_fkey
    foreign key (evaluation_id)
    references public.evaluations (id)
    on delete set null,
  constraint evaluation_attempts_attempt_number_check
    check (attempt_number > 0),
  constraint evaluation_attempts_outcome_check
    check (outcome in ('received', 'success', 'failed')),
  constraint evaluation_attempts_run_attempt_key
    unique (run_id, attempt_number)
);

create index evaluation_attempts_application_created_idx
  on public.evaluation_attempts (application_id, created_at desc);
create index evaluation_attempts_evaluation_id_idx
  on public.evaluation_attempts (evaluation_id);

alter table public.evaluation_attempts enable row level security;

revoke all on table public.evaluation_attempts from public, anon, authenticated;
grant select, insert, update, delete on table public.evaluation_attempts to service_role;
