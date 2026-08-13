alter table public.evaluations
  add column if not exists evaluation_origin text not null default 'agent',
  add column if not exists source_evaluation_id uuid;

alter table public.evaluations
  drop constraint if exists evaluations_evaluation_origin_check,
  add constraint evaluations_evaluation_origin_check
    check (evaluation_origin in ('agent', 'recalculation')),
  drop constraint if exists evaluations_source_evaluation_id_fkey,
  add constraint evaluations_source_evaluation_id_fkey
    foreign key (source_evaluation_id)
    references public.evaluations (id)
    on delete set null;

create index if not exists evaluations_source_evaluation_id_idx
  on public.evaluations (source_evaluation_id);

create or replace function public.create_rubric_version_and_recalculate(
  p_weights jsonb,
  p_description text default null
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_rubric_id integer;
  v_recalculated integer;
  v_total numeric;
begin
  if jsonb_typeof(p_weights) <> 'object'
    or (select count(*) from jsonb_object_keys(p_weights)) <> 7
    or not p_weights ?& array[
      'rest_api', 'llm_experience', 'agentic_mcp', 'bonus_tools',
      'verifiability', 'learning_signal', 'cv_quality'
    ]
  then
    raise exception 'Invalid rubric keys';
  end if;

  select sum(value::numeric) into v_total
  from jsonb_each_text(p_weights);

  if v_total <> 1
    or exists (
      select 1 from jsonb_each_text(p_weights)
      where value::numeric < 0 or value::numeric > 1
    )
  then
    raise exception 'Rubric weights must total 1 and remain between 0 and 1';
  end if;

  perform pg_advisory_xact_lock(hashtext('applyzer-rubric-version'));

  update public.rubric_versions set is_active = false where is_active;
  insert into public.rubric_versions (weights, is_active, description)
  values (p_weights, true, nullif(trim(p_description), ''))
  returning id into v_rubric_id;

  with latest as (
    select distinct on (e.application_id) e.*, a.office_days_per_week
    from public.evaluations e
    join public.applications a on a.id = e.application_id
    order by e.application_id, e.created_at desc, e.id desc
  ), calculated as (
    select latest.*,
      round((
        ((criteria->'rest_api'->>'score')::numeric * (p_weights->>'rest_api')::numeric) +
        ((criteria->'llm_experience'->>'score')::numeric * (p_weights->>'llm_experience')::numeric) +
        ((criteria->'agentic_mcp'->>'score')::numeric * (p_weights->>'agentic_mcp')::numeric) +
        ((criteria->'bonus_tools'->>'score')::numeric * (p_weights->>'bonus_tools')::numeric) +
        ((criteria->'verifiability'->>'score')::numeric * (p_weights->>'verifiability')::numeric) +
        ((criteria->'learning_signal'->>'score')::numeric * (p_weights->>'learning_signal')::numeric) +
        ((criteria->'cv_quality'->>'score')::numeric * (p_weights->>'cv_quality')::numeric)
      ) * 20, 2) as recalculated_score
    from latest
  ), prepared as (
    select calculated.*,
      case
        when recalculated_score >= 70 then 'yes'::public.recommendation
        when recalculated_score >= 50 then 'maybe'::public.recommendation
        else 'no'::public.recommendation
      end as threshold_recommendation
    from calculated
  )
  insert into public.evaluations (
    application_id, rubric_version_id, criteria, strengths, risks, rationale,
    cv_summary, department_fit, location_note, model_recommendation,
    final_score, score_breakdown, final_recommendation, override_reason,
    injection_detected, injection_note, model, tool_call_count, duration_ms,
    raw_response, evaluation_origin, source_evaluation_id
  )
  select
    application_id, v_rubric_id, criteria, strengths, risks, rationale,
    cv_summary, department_fit, location_note, model_recommendation,
    recalculated_score,
    jsonb_build_array(
      jsonb_build_object('key','rest_api','score',(criteria->'rest_api'->>'score')::int,'weight',(p_weights->>'rest_api')::numeric,'contribution',round((criteria->'rest_api'->>'score')::numeric*(p_weights->>'rest_api')::numeric*20,2)),
      jsonb_build_object('key','llm_experience','score',(criteria->'llm_experience'->>'score')::int,'weight',(p_weights->>'llm_experience')::numeric,'contribution',round((criteria->'llm_experience'->>'score')::numeric*(p_weights->>'llm_experience')::numeric*20,2)),
      jsonb_build_object('key','agentic_mcp','score',(criteria->'agentic_mcp'->>'score')::int,'weight',(p_weights->>'agentic_mcp')::numeric,'contribution',round((criteria->'agentic_mcp'->>'score')::numeric*(p_weights->>'agentic_mcp')::numeric*20,2)),
      jsonb_build_object('key','bonus_tools','score',(criteria->'bonus_tools'->>'score')::int,'weight',(p_weights->>'bonus_tools')::numeric,'contribution',round((criteria->'bonus_tools'->>'score')::numeric*(p_weights->>'bonus_tools')::numeric*20,2)),
      jsonb_build_object('key','verifiability','score',(criteria->'verifiability'->>'score')::int,'weight',(p_weights->>'verifiability')::numeric,'contribution',round((criteria->'verifiability'->>'score')::numeric*(p_weights->>'verifiability')::numeric*20,2)),
      jsonb_build_object('key','learning_signal','score',(criteria->'learning_signal'->>'score')::int,'weight',(p_weights->>'learning_signal')::numeric,'contribution',round((criteria->'learning_signal'->>'score')::numeric*(p_weights->>'learning_signal')::numeric*20,2)),
      jsonb_build_object('key','cv_quality','score',(criteria->'cv_quality'->>'score')::int,'weight',(p_weights->>'cv_quality')::numeric,'contribution',round((criteria->'cv_quality'->>'score')::numeric*(p_weights->>'cv_quality')::numeric*20,2))
    ),
    case when office_days_per_week = 'remote_only' and threshold_recommendation = 'yes'
      then 'maybe'::public.recommendation else threshold_recommendation end,
    nullif(concat_ws(' ',
      case when model_recommendation <> threshold_recommendation then
        format('Model recommendation %L was replaced by the deterministic score threshold %L.', model_recommendation, threshold_recommendation) end,
      case when office_days_per_week = 'remote_only' and threshold_recommendation = 'yes' then
        'Remote-only availability (0 office days) downgraded ''yes'' to ''maybe''.' end
    ), ''),
    injection_detected, injection_note, model, 0, 0,
    jsonb_build_object('type','rubric_recalculation','source_evaluation_id',id),
    'recalculation', id
  from prepared;

  get diagnostics v_recalculated = row_count;
  return jsonb_build_object(
    'rubric_version_id', v_rubric_id,
    'recalculated_count', v_recalculated
  );
end;
$$;

revoke all on function public.create_rubric_version_and_recalculate(jsonb, text)
  from public, anon, authenticated;
grant execute on function public.create_rubric_version_and_recalculate(jsonb, text)
  to service_role;
