create type public.recommendation as enum ('yes', 'maybe', 'no');
create type public.department_fit as enum ('match', 'related', 'unrelated');

create table public.evaluations (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null,
  rubric_version_id integer not null,

  criteria jsonb not null,
  strengths text[] not null default '{}'::text[],
  risks text[] not null default '{}'::text[],
  rationale text not null,
  cv_summary text not null,
  department_fit public.department_fit not null,
  location_note text,
  model_recommendation public.recommendation not null,

  final_score numeric(5, 2) not null,
  score_breakdown jsonb not null,
  final_recommendation public.recommendation not null,
  override_reason text,

  injection_detected boolean not null default false,
  injection_note text,

  model text not null,
  tool_call_count integer not null default 0,
  duration_ms integer,
  raw_response jsonb,
  evaluation_origin text not null default 'agent',
  source_evaluation_id uuid,

  created_at timestamptz not null default now(),

  constraint evaluations_application_id_fkey
    foreign key (application_id)
    references public.applications (id)
    on delete cascade,
  constraint evaluations_rubric_version_id_fkey
    foreign key (rubric_version_id)
    references public.rubric_versions (id),
  constraint evaluations_source_evaluation_id_fkey
    foreign key (source_evaluation_id)
    references public.evaluations (id)
    on delete set null,
  constraint evaluations_evaluation_origin_check
    check (evaluation_origin in ('agent', 'recalculation'))
);

create index evaluations_application_created_idx
  on public.evaluations (application_id, created_at desc);
create index evaluations_rubric_version_id_idx
  on public.evaluations (rubric_version_id);
create index evaluations_source_evaluation_id_idx
  on public.evaluations (source_evaluation_id);
create index evaluations_final_score_idx
  on public.evaluations (final_score desc);
create index evaluations_final_recommendation_idx
  on public.evaluations (final_recommendation);

alter table public.evaluations enable row level security;

revoke all on table public.evaluations from public, anon, authenticated;
grant select, insert, update, delete on table public.evaluations to service_role;
